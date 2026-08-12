import { getAllWorks } from "@/lib/supabase/getAllWorks";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { updateDmmItem } from "./update";
import {
  beginJob,
  updateJob,
  finishJob,
  JOBS,
} from "@/lib/jobs";

export async function updateReviewWorks() {
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
  "id, product_id, review_count, review_average, maker, series, url, release_date"
);

if (works.length === 0) {
    console.log("レビュー更新対象なし");
    return;
  }

  const job = await beginJob(
  JOBS.REVIEW,
  works.length
);

const DMM_PARALLEL = 5;

const processedCount =
  job.processed_count ?? 0;

const targets =
  works.slice(processedCount);

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
  ])
);

console.log(
  `レビュー更新開始 (${processedCount}/${works.length}から再開)`
);

  let success = 0;
let skip = 0;
let failed = 0;

let current = processedCount;

for (
  let i = 0;
  i < targets.length;
  i += DMM_PARALLEL
) {
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

        console.error(
          `[ERROR] ${work.product_id}`,
          error
        );
      }
    })
  );

  current += batch.length;

await updateJob(
  JOBS.REVIEW,
  Math.min(current, works.length),
  batch[batch.length - 1].product_id
);

  console.log(
    `レビュー更新 ${Math.min(
      current,
      works.length
    )}/${works.length}`
  );
}

await finishJob(
  JOBS.REVIEW
);

  console.log("===== レビュー更新完了 =====");
console.log(`成功 : ${success}`);
console.log(`スキップ : ${skip}`);
console.log(`失敗 : ${failed}`);
}
