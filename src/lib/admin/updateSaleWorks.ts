import { supabase } from "@/lib/supabase";
import { UPDATE_CONFIG } from "@/config/update";

import {
  createBrowser,
  closeBrowser,
} from "@/lib/playwright/browserManager";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { getSaleItems } from "@/lib/playwright/getSaleItems";

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

  const { products } = await getSaleItems();

console.log("② getSaleItems 完了");
console.log("取得件数 =", products.length);
  

const saleIds = new Set(
  products.map((p) => p.productId)
);

const allWorks: {
  product_id: string;
  url: string | null;
  price: number | null;
  sale_price: number | null;
  is_on_sale: boolean | null;
  sale_end_at: string | null;
}[] = [];

console.log("③ worksテーブル取得開始");

let from = 0;
const pageSize = 1000;

while (true) {
  const { data, error } = await supabase
    .from("works")
    .select(`
      product_id,
      url,
      price,
      sale_price,
      is_on_sale,
      sale_end_at
    `)
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

console.log("④ works取得完了");
console.log("works総数 =", allWorks.length);

const works =
  (allWorks ?? []).filter((work) =>
    saleIds.has(work.product_id)
  );

console.log("⑤ セール抽出完了");
console.log("Playwright取得 =", products.length);
console.log("works総数 =", allWorks.length);
console.log("一致件数 =", works.length);

if (works.length === 0) {
  console.log("更新対象のセール作品はありません");
  return;
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

      await Promise.all(
  batch.map(async (work) => {
    const needsPlaywright =
      !work.sale_price ||
      !work.sale_end_at;

    if (!needsPlaywright) {
      return;
    }

    console.log(
      `▶ Playwright価格更新 ${work.product_id}`
    );

    await updatePlaywrightItem(
      work.product_id,
      work.url,
      browser,
      work.price
    );
  })
);

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
        `${processed}/${works.length}`
      );
    }

    await finishJob(JOBS.SALE);

    console.log("⑨ セール更新完了");
console.log("======================================");
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