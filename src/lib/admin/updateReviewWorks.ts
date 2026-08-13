import { getAllWorks } from "@/lib/supabase/getAllWorks";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { updateDmmItem } from "./update";
import {
  beginJob,
  updateJob,
  finishJob,
  JOBS,
} from "@/lib/jobs";

type ReviewUpdateOptions = {
  maxItems?: number;
  timeBudgetMs?: number;
};

export type ReviewUpdateResult = {
  completed: boolean;
  processedCount: number;
  totalCount: number;
  batchProcessed: number;
  success: number;
  skip: number;
  failed: number;
};

const DMM_PARALLEL = 5;

export async function updateReviewWorks(
  options: ReviewUpdateOptions = {},
): Promise<ReviewUpdateResult> {
  const works = await getAllWorks<{
    id: number;
    product_id: string;
    review_count: number;
    review_average: number;
    maker: string;
    series: string;
    url: string;
    release_date: string | null;
  }>(
    "id, product_id, review_count, review_average, maker, series, url, release_date",
  );

  works.sort((a, b) => a.id - b.id);

  if (works.length === 0) {
    console.log("レビュー更新対象なし");
    return {
      completed: true,
      processedCount: 0,
      totalCount: 0,
      batchProcessed: 0,
      success: 0,
      skip: 0,
      failed: 0,
    };
  }

  const job = await beginJob(JOBS.REVIEW, works.length);
  const processedCount = Math.min(job.processed_count ?? 0, works.length);

  const maxItems =
    options.maxItems === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(1, options.maxItems);

  const targetEnd = Math.min(works.length, processedCount + maxItems);
  const targets = works.slice(processedCount, targetEnd);
  const deadline =
    options.timeBudgetMs && options.timeBudgetMs > 0
      ? Date.now() + options.timeBudgetMs
      : null;

  const workMap = new Map(
    works.map((work) => [
      work.product_id,
      {
        id: work.id,
        review_count: work.review_count ?? 0,
        review_average: work.review_average ?? 0,
        maker: work.maker ?? "",
        series: work.series ?? "",
        url: work.url ?? "",
        release_date: work.release_date,
      },
    ]),
  );

  console.log(
    `レビュー更新開始 (${processedCount}/${works.length}から再開、今回最大${targets.length}件)`,
  );

  let success = 0;
  let skip = 0;
  let failed = 0;
  let current = processedCount;

  for (let i = 0; i < targets.length; i += DMM_PARALLEL) {
    if (i > 0 && deadline !== null && Date.now() >= deadline) {
      console.log(
        `レビュー更新を時間予算で中断 (${current}/${works.length})`,
      );
      break;
    }

    const batch = targets.slice(i, i + DMM_PARALLEL);

    await Promise.all(
      batch.map(async (work) => {
        try {
          const item = await getDmmItem(work.product_id);

          if (!item) {
            skip++;
            console.log(`[SKIP] ${work.product_id}`);
            return;
          }

          const currentWork = workMap.get(work.product_id);

          await updateDmmItem(item, currentWork);
          success++;
        } catch (error) {
          failed++;
          console.error(`[ERROR] ${work.product_id}`, error);
        }
      }),
    );

    current += batch.length;

    await updateJob(
      JOBS.REVIEW,
      Math.min(current, works.length),
      batch[batch.length - 1].product_id,
    );

    console.log(
      `レビュー更新 ${Math.min(current, works.length)}/${works.length}`,
    );
  }

  const completed = current >= works.length;

  if (completed) {
    await finishJob(JOBS.REVIEW);
    console.log("===== レビュー更新完了 =====");
  } else {
    console.log(
      `===== レビュー更新バッチ完了 (${current}/${works.length}) =====`,
    );
  }

  console.log(`成功 : ${success}`);
  console.log(`スキップ : ${skip}`);
  console.log(`失敗 : ${failed}`);

  return {
    completed,
    processedCount: current,
    totalCount: works.length,
    batchProcessed: current - processedCount,
    success,
    skip,
    failed,
  };
}
