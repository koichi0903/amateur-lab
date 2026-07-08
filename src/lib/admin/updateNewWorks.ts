import { supabase } from "@/lib/supabase";
import { UPDATE_CONFIG } from "@/config/update";
import { updateWork } from "./updateWork";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

export async function updateNewWorks() {
  const borderDate = new Date();

  borderDate.setDate(
    borderDate.getDate() - UPDATE_CONFIG.newReleaseDays
  );

  const { data: works, error } = await supabase
    .from("works")
    .select("product_id, release_date")
    .gte(
      "release_date",
      borderDate.toISOString().slice(0, 10)
    );

  if (error) {
    throw error;
  }

  if (!works || works.length === 0) {
    console.log("更新対象の新作はありません");
    return;
  }

  const job = await beginJob(
    JOBS.NEW,
    works.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets = works.slice(processedCount);

  console.log(
    `新作更新開始 (${processedCount}/${works.length}から再開)`
  );

  let current = processedCount;

  try {
    for (
      let i = 0;
      i < targets.length;
      i += UPDATE_CONFIG.parallel
    ) {
      const batch = targets.slice(
        i,
        i + UPDATE_CONFIG.parallel
      );

      await Promise.all(
  batch.map((work) =>
    updateWork(work.product_id)
  )
);

// Promise.all が終わった時点で、この batch は全件成功
current += batch.length;

// 10件ごと、または最後だけ保存
if (
  current %
    UPDATE_CONFIG.jobUpdateInterval ===
    0 ||
  current === works.length
) {
  const lastWork =
    batch[batch.length - 1];

  await updateJob(
    JOBS.NEW,
    current,
    lastWork.product_id
  );
}

console.log(
  `${current}/${works.length}`
);
    }

    await finishJob(JOBS.NEW);

    console.log("新作更新完了");
  } catch (error) {
    await failJob(
      JOBS.NEW,
      error instanceof Error
        ? error.message
        : String(error)
    );

    throw error;
  }
}