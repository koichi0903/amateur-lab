import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { getAllWorks } from "@/lib/supabase/getAllWorks";
import { updateDmmItem } from "./update";

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

type ReviewTarget = {
  id: number;
  product_id: string;
  review_count: number;
  review_average: number;
  maker: string;
  series: string;
  url: string;
  release_date: string | null;
  actress: string | null;
};

type UpdateResult = "success" | "skip" | "failed";

const DMM_PARALLEL = 5;

export async function updateReviewWorks(
  options: ReviewUpdateOptions = {},
): Promise<ReviewUpdateResult> {
  const works = await getAllWorks<ReviewTarget>(
    "id, product_id, review_count, review_average, maker, series, url, release_date, actress",
  );
  works.sort((a, b) => a.id - b.id);

  if (works.length === 0) {
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
  const initialProcessedCount = Math.min(job.processed_count ?? 0, works.length);
  const maxItems =
    options.maxItems === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(1, options.maxItems);
  const targetEnd = Math.min(works.length, initialProcessedCount + maxItems);
  const targets = works.slice(initialProcessedCount, targetEnd);
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
        actress: work.actress,
      },
    ]),
  );

  let success = 0;
  let skip = 0;
  let failed = 0;
  let current = initialProcessedCount;

  const updateOne = async (work: ReviewTarget): Promise<UpdateResult> => {
    try {
      const item = await getDmmItem(work.product_id);
      if (!item) return "skip";

      await updateDmmItem(item, workMap.get(work.product_id), {
        // 正確な価格・セール情報はPlaywright更新に任せる。
        updatePrices: false,
      });
      return "success";
    } catch (error) {
      console.error(`[ERROR] ${work.product_id}`, error);
      return "failed";
    }
  };

  try {
    for (let index = 0; index < targets.length; index += DMM_PARALLEL) {
      if (index > 0 && deadline !== null && Date.now() >= deadline) break;

      const batch = targets.slice(index, index + DMM_PARALLEL);
      const firstResults = await Promise.all(batch.map(updateOne));
      const retryTargets = batch.filter(
        (_, resultIndex) => firstResults[resultIndex] !== "success",
      );
      const retryResults =
        retryTargets.length > 0
          ? await Promise.all(retryTargets.map(updateOne))
          : [];
      const retryResultMap = new Map(
        retryTargets.map((work, retryIndex) => [
          work.product_id,
          retryResults[retryIndex],
        ]),
      );

      const unresolvedFailures: string[] = [];
      for (let resultIndex = 0; resultIndex < batch.length; resultIndex++) {
        const work = batch[resultIndex];
        const firstResult = firstResults[resultIndex];
        const finalResult =
          firstResult === "success"
            ? firstResult
            : retryResultMap.get(work.product_id) ?? firstResult;

        if (finalResult === "success") success++;
        else if (finalResult === "skip") {
          skip++;
          console.log(`[SKIP] ${work.product_id}`);
        } else {
          failed++;
          unresolvedFailures.push(work.product_id);
        }
      }

      if (unresolvedFailures.length > 0) {
        throw new Error(
          `レビュー更新に失敗した作品があります: ${unresolvedFailures.join(", ")}`,
        );
      }

      current += batch.length;
      await updateJob(
        JOBS.REVIEW,
        Math.min(current, works.length),
        batch.at(-1)?.product_id ?? "",
      );
      console.log(`レビュー更新 ${Math.min(current, works.length)}/${works.length}`);
    }

    const completed = current >= works.length;
    if (completed) await finishJob(JOBS.REVIEW);

    return {
      completed,
      processedCount: current,
      totalCount: works.length,
      batchProcessed: current - initialProcessedCount,
      success,
      skip,
      failed,
    };
  } catch (error) {
    await failJob(
      JOBS.REVIEW,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
