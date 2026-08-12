import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { updateWork } from "./updateWork";
import { UPDATE_CONFIG } from "@/config/update";

import {
  createBrowser,
  closeBrowser,
} from "@/lib/playwright/browserManager";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

export async function updateEndedSaleWorks() {
  const now = new Date().toISOString();

  const allWorks: {
    product_id: string;
    sale_end_at: string | null;
  }[] = [];

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(`
  product_id,
  sale_end_at,
  is_on_sale
`)
      .not("sale_end_at", "is", null)
.eq("is_on_sale", true)
.lte("sale_end_at", now)

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
    `終了したセール作品 ${allWorks.length}件`
  );

  const job = await beginJob(
  JOBS.ENDED_SALE,
  allWorks.length
);

const processedCount =
  job.processed_count ?? 0;

const targets =
  allWorks.slice(processedCount);

let processed = processedCount;

let browser =
  await createBrowser();

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

  console.log(
  `========================`
);
console.log(
  `Batch ${i / UPDATE_CONFIG.parallel + 1}`
);
console.log(
  batch.map((w) => w.product_id)
);
console.log(
  `========================`
);

  await Promise.all(
  batch.map(async (work) => {
    console.log(
      `▶ 終了セール更新開始 ${work.product_id}`
    );

    try {
      await updateWork(
        work.product_id,
        undefined,
        browser
      );

      console.log(
        `✅ 更新成功 ${work.product_id}`
      );
    } catch (error) {
      console.error(
        `❌ 更新失敗 ${work.product_id}`,
        error
      );

      throw error;
    }
  })
);

  processed += batch.length;

  if (
    processed %
      UPDATE_CONFIG.browserRestartInterval ===
    0
  ) {
    console.log(
      `🔄 Browser再起動 (${processed}件処理)`
    );

    await closeBrowser(browser);

    browser = await createBrowser();
  }

  if (
    processed %
      UPDATE_CONFIG.jobUpdateInterval ===
    0
  ) {
    await updateJob(
      JOBS.ENDED_SALE,
      processed,
      batch[batch.length - 1].product_id
    );
  }

  console.log(
    `${processed}/${targets.length}`
  );
}

  await updateJob(
  JOBS.ENDED_SALE,
  processed,
  targets.at(-1)?.product_id ?? ""
);

await finishJob(
  JOBS.ENDED_SALE
);
} catch (error) {
  await failJob(
    JOBS.ENDED_SALE,
    error instanceof Error
      ? error.message
      : String(error)
  );

  throw error;
} finally {
  await closeBrowser(browser);
}

  console.log("終了セール更新完了");
}
