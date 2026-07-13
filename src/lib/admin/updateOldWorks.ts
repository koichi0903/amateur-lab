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

export async function updateOldWorks() {
  const sevenDaysAgo = new Date();

sevenDaysAgo.setDate(
  sevenDaysAgo.getDate() - 7
);

const todayGroup =
  Math.floor(Date.now() / 86400000) % 7;

const { data: works, error } = await supabase
  .from("works")
  .select(`
    product_id,
    release_date,
    updated_at
  `)
  .eq("stage", "OLD")
  .eq("is_bottom_price", false)
  .or(
    `updated_at.is.null,updated_at.lte.${sevenDaysAgo.toISOString()}`
  );

  if (error) {
    throw error;
  }

  if (!works || works.length === 0) {
    console.log("更新対象の旧作はありません");
    return;
  }

const filteredWorks = works.filter((work) => {
  if (!work.release_date) {
    return false;
  }

  const releaseGroup =
  Math.floor(
    new Date(work.release_date!).getTime() /
      86400000
  ) % 7;

  return releaseGroup === todayGroup;
});

const job = await beginJob(
  JOBS.OLD,
  filteredWorks.length
);

const processedCount =
  job.processed_count ?? 0;

const targets =
  filteredWorks.slice(processedCount);
  console.log(
  `旧作更新開始 (${processedCount}/${targets.length}から再開)`
);

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

      const processed =
        processedCount +
        i +
        batch.length;

      await updateJob(
        JOBS.OLD,
        processed,
        batch[batch.length - 1].product_id
      );

      console.log(
        `${processed}/${targets.length}`
      );
    }

    await finishJob(JOBS.OLD);

    console.log("旧作更新完了");
  } catch (error) {
    await failJob(
      JOBS.OLD,
      error instanceof Error
        ? error.message
        : String(error)
    );

    throw error;
  }
}