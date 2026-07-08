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

export async function updateSemiNewWorks() {
  const today = new Date();

  const newBorder = new Date(today);
  newBorder.setDate(
    newBorder.getDate() - UPDATE_CONFIG.newReleaseDays
  );

  const semiBorder = new Date(today);
  semiBorder.setDate(
    semiBorder.getDate() -
      UPDATE_CONFIG.semiNewReleaseDays
  );

  const { data: works, error } = await supabase
    .from("works")
    .select("product_id, release_date")
    .lt(
      "release_date",
      newBorder.toISOString().slice(0, 10)
    )
    .gte(
      "release_date",
      semiBorder.toISOString().slice(0, 10)
    );

  if (error) {
    throw error;
  }

  if (!works || works.length === 0) {
    console.log("更新対象の準新作はありません");
    return;
  }

  const job = await beginJob(
    JOBS.SEMI_NEW,
    works.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets = works.slice(processedCount);

  console.log(
    `準新作更新開始 (${processedCount}/${works.length}から再開)`
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
        processedCount + i + batch.length;

            await updateJob(
        JOBS.SEMI_NEW,
        processed,
        batch[batch.length - 1].product_id
      );

      console.log(
        `${processed}/${works.length}`
      );
    }

    await finishJob(JOBS.SEMI_NEW);

    console.log("準新作更新完了");
  } catch (error) {
    await failJob(
      JOBS.SEMI_NEW,
      error instanceof Error
        ? error.message
        : String(error)
    );

    throw error;
  }
}