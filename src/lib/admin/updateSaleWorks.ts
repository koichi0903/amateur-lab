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

export async function updateSaleWorks() {
  const { data: works, error } = await supabase
    .from("works")
    .select("product_id")
    .eq("is_on_sale", true);

  if (error) {
    throw error;
  }

  if (!works || works.length === 0) {
    console.log("更新対象のセール作品はありません");
    return;
  }

  const job = await beginJob(
    JOBS.SALE,
    works.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets = works.slice(processedCount);

  console.log(
    `セール更新開始 (${processedCount}/${works.length}から再開)`
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

      if (
        processed %
          UPDATE_CONFIG.jobUpdateInterval ===
          0 ||
        processed >= works.length
      ) {
        await updateJob(
          JOBS.SALE,
          processed,
          batch[batch.length - 1].product_id
        );
      }

      console.log(
        `${processed}/${works.length}`
      );
    }

    await finishJob(JOBS.SALE);

    console.log("セール更新完了");
  } catch (error) {
    await failJob(
      JOBS.SALE,
      error instanceof Error
        ? error.message
        : String(error)
    );

    throw error;
  }
}