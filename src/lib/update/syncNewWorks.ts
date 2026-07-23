import { supabase } from "@/lib/supabase";

import { getNewItems } from "@/lib/playwright/getNewItems";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { UPDATE_CONFIG } from "@/config/update";

import { saveDmmItem } from "@/lib/admin/save";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import {
  createBrowser,
  closeBrowser,
} from "@/lib/playwright/browserManager";

import {
  beginJob,
  finishJob,
  failJob,
  updateJob,
  JOBS,
} from "@/lib/jobs";

const DMM_PARALLEL = 5;
const JOB_SAVE_INTERVAL = 6;

export async function syncNewWorks() {
  const startedAt = Date.now();

  const { products } = await getNewItems();

console.log("products.length =", products.length);

console.log("FIRST PRODUCT =", products[0]);

const job = await beginJob(
  JOBS.NEW_SYNC,
  products.length
);

  const processedCount =
    job.processed_count ?? 0;

  const targets =
  products.slice(processedCount);

  let browser = await createBrowser();

try {
    const { data: works, error } = await supabase
  .from("works")
  .select(`
  product_id,
  price,
  sale_price,
  list_price
`);

    if (error) {
      throw error;
    }

    const existingWorks = new Map(
  (works ?? []).map((w) => [
    w.product_id,
    w,
  ])
);

    let processed = processedCount;
    let inserted = 0;
    let skipped = 0;

    console.log("================================");
    console.log("🚀 新作同期開始");
    console.log("================================");
    console.log(`取得件数 : ${products.length}`);
    console.log(`途中再開 : ${processedCount}件`);
    console.log("================================");

    for (
      let i = 0;
      i < targets.length;
      i += DMM_PARALLEL
    ) {
      const batch = targets.slice(
        i,
        i + DMM_PARALLEL
      );

      const items = await Promise.all(
        batch.map(async (product) => {
          const existing =
  existingWorks.get(product.productId);

if (existing) {
  const needsPriceUpdate =
    existing.price == null ||
    existing.list_price !==
      product.listPrice;

  return {
    product,
    item: null,
    exists: true,
    existing,
    needsPriceUpdate,
  };
}

          const item =
  await getDmmItem(product.productId);

          return {
  product,
  item,
  exists: false,
};
        })
      );

      for (const row of items) {
        if (row.exists && row.needsPriceUpdate) {
  await updatePlaywrightItem(
  row.product.productId,
  undefined,
  browser,
  row.product.listPrice
);

  processed++;



if (
  processed % JOB_SAVE_INTERVAL ===
  0
) {
  await updateJob(
    JOBS.NEW_SYNC,
    processed,
    row.product.productId
  );

  console.log(
    `${processed}/${products.length}`
  );
}

  continue;
}

if (row.exists && !row.needsPriceUpdate) {
  skipped++;
  processed++;

  if (processed % JOB_SAVE_INTERVAL === 0) {
    await updateJob(
  JOBS.NEW_SYNC,
      processed,
      row.product.productId
    );
  }

  continue;
}

if (!row.item) {
  console.warn(
    `DMM取得失敗: ${row.product.productId}`
  );

  processed++;

  if (
    processed % JOB_SAVE_INTERVAL === 0
  ) {
    await updateJob(
  JOBS.NEW_SYNC,
      processed,
      row.product.productId
    );
  }

  continue;
}

const saved =
  await saveDmmItem(
    row.item,
    undefined
  );

if (saved) {
  inserted++;

  try {
    await updatePlaywrightItem(
  row.product.productId,
  row.item.URL ?? row.item.affiliateURL,
  browser,
  row.product.listPrice
);
  } catch (error) {
    console.error(
      `Playwright更新失敗: ${row.product.productId}`,
      error
    );
  }
}

processed++;

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
  processed % JOB_SAVE_INTERVAL ===
  0
) {
  await updateJob(
    JOBS.NEW_SYNC,
    processed,
    row.product.productId
  );

  console.log(
    `${processed}/${products.length}`
  );
}
      }
    }

    await updateJob(
  JOBS.NEW_SYNC,
  processed,
      targets.at(-1)?.productId ?? ""
    );

    await finishJob(JOBS.NEW_SYNC);

    console.log("================================");
    console.log("✅ 新作同期完了");
    console.log(`登録 : ${inserted}件`);
    console.log(`スキップ : ${skipped}件`);
    console.log(
      `処理時間 : ${Math.round(
        (Date.now() - startedAt) / 1000
      )}秒`
    );
    console.log("================================");
  } catch (error) {
  await failJob(
  JOBS.NEW_SYNC,
    error instanceof Error
      ? error.message
      : String(error)
  );

  throw error;
} finally {
  await closeBrowser(browser);
}
}