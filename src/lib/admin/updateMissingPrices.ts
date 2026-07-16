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

export async function updateMissingPrices() {
  const allWorks: {
    product_id: string;
  }[] = [];

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id")
      .is("price", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allWorks.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  console.log(
    `価格補完対象 ${allWorks.length}件`
  );

  const job = await beginJob(
  JOBS.MISSING_PRICES,
  allWorks.length
);

const processedCount =
  job.processed_count ?? 0;

const targets =
  allWorks.slice(processedCount);

  try {

  const BATCH_SIZE =
    UPDATE_CONFIG.parallel;

  for (
  let i = 0;
  i < targets.length;
  i += BATCH_SIZE
) {
    const batch = targets.slice(
  i,
  i + BATCH_SIZE
);

    await Promise.allSettled(
      batch.map((work) =>
        updateWork(work.product_id)
      )
    );

    const processed =
  processedCount + i + batch.length;

await updateJob(
  JOBS.MISSING_PRICES,
  processed,
  batch[batch.length - 1].product_id
);

    console.log(
  `${processed}/${allWorks.length}`
);
  }

  await finishJob(
  JOBS.MISSING_PRICES
);

console.log("価格補完完了");

} catch (error) {
  await failJob(
    JOBS.MISSING_PRICES,
    error instanceof Error
      ? error.message
      : String(error)
  );

  throw error;
}
}