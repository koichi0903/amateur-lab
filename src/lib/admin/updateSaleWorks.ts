import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { UPDATE_CONFIG } from "@/config/update";

import {
  createBrowser,
  closeBrowser,
} from "@/lib/playwright/browserManager";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { getSaleItems } from "@/lib/playwright/getSaleItems";
import { notifyPriceAlertsForProducts } from "@/lib/pushNotifications";
import { processSaleWorkBatch } from "./saleWorkBatch";
import { collectSaleWorks } from "./saleWorkQuery";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

export async function updateSaleWorks() {

  console.log("");
console.log("======================================");
console.log("💰 updateSaleWorks 開始");
console.log("======================================");

console.log("① getSaleItems 開始");

  const { products, totalPages } = await getSaleItems();

  if (products.length === 0) {
    throw new Error(
      `セール一覧を取得できませんでした（検出ページ数: ${totalPages}）`,
    );
  }

console.log("② getSaleItems 完了");
console.log("取得件数 =", products.length);
  

const saleIds = new Set(
  products.map((p) => p.productId)
);

console.log("③ worksテーブル取得開始");
const { allWorks, works } = await collectSaleWorks(
  saleIds,
  async (from, to) => supabase
    .from("works")
    .select(`
      product_id,
      url,
      price,
      sale_price,
      is_on_sale,
      sale_end_at
    `)
    .order("product_id")
    .range(from, to),
);

console.log("④ works取得完了");
console.log("works総数 =", allWorks.length);

console.log("⑤ セール抽出完了");
console.log("Playwright取得 =", products.length);
console.log("works総数 =", allWorks.length);
console.log("一致件数 =", works.length);

if (works.length === 0) {
  console.log("更新対象のセール作品はありません");
  return { workIds: [] as string[] };
}

console.log("⑥ beginJob開始");

  const job = await beginJob(
    JOBS.SALE,
    works.length
  );

  console.log("⑦ beginJob完了");
console.log("status =", job.status);
console.log("processed =", job.processed_count);
console.log("total =", job.total_count);

  const processedCount =
    job.processed_count ?? 0;

  const targets = works.slice(processedCount);

  console.log(
    `セール更新開始 (${processedCount}/${works.length}から再開)`
  );

  let browser = await createBrowser();
  let succeeded = 0;
  let failed = 0;
  const updatedWorkIds: string[] = [];

  try {

    console.log("⑧ 更新ループ開始");
console.log("targets =", targets.length);
    for (
      let i = 0;
      i < targets.length;
      i += UPDATE_CONFIG.parallel
    ) {
      const batch = targets.slice(
        i,
        i + UPDATE_CONFIG.parallel
      );

      const results = await processSaleWorkBatch(
        batch,
        async (work) => {
          console.log(`▶ Playwright価格更新 ${work.product_id}`);
          return updatePlaywrightItem(work.product_id, work.url, browser, work.price);
        },
        (productId) => updatedWorkIds.push(productId),
        (work, error) => console.error(`[SALE_UPDATE_ERROR] ${work.product_id}`, error),
      );

      succeeded += results.filter(Boolean).length;
      failed += results.filter((result) => !result).length;

      const processed =
        processedCount + i + batch.length;

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

      await updateJob(
  JOBS.SALE,
  processed,
  batch[batch.length - 1].product_id
);

      console.log(
        `${processed}/${works.length} success=${succeeded} failed=${failed}`
      );
    }

    await finishJob(JOBS.SALE);

    try {
      await notifyPriceAlertsForProducts(updatedWorkIds);
    } catch (notificationError) {
      console.error("[push] sale price notifications failed", notificationError);
    }

console.log("⑨ セール更新完了");
console.log("======================================");
    return { workIds: updatedWorkIds };
  } catch (error) {
  await failJob(
    JOBS.SALE,
    error instanceof Error
      ? error.message
      : String(error)
  );

  throw error;
} finally {
  await closeBrowser(browser);
}
}
