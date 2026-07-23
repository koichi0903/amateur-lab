import { supabase } from "@/lib/supabase";
import { UPDATE_CONFIG } from "@/config/update";
import { getSemiNewItems } from "@/lib/playwright/getSemiNewItems";

import {
  createBrowser,
  closeBrowser,
} from "@/lib/playwright/browserManager";
import { updateWork } from "./updateWork";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

export async function updateSemiNewWorks() {
  
  let works: {
  product_id: string;
  release_date: string;
  list_price: number | null;
  sale_price: number | null;
}[] = [];

let from = 0;
const PAGE_SIZE = 1000;

while (true) {
  const { data, error } = await supabase
  .from("works")
  .select(
  "product_id, release_date, list_price, sale_price, stage"
)
.eq("stage", "SEMI_NEW")
  .eq("stage", "SEMI_NEW")
  .range(from, from + PAGE_SIZE - 1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    break;
  }

  works.push(...data);

  if (data.length < PAGE_SIZE) {
    break;
  }

  from += PAGE_SIZE;
}

console.log(
  "準新作取得件数:",
  works.length
);

  if (!works || works.length === 0) {
    console.log("更新対象の準新作はありません");
    return;
  }

  // Playwright一覧取得
const { products } = await getSemiNewItems();

// productId → 一覧情報
const productMap = new Map(
  products.map((p) => [p.productId, p])
);

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

  let browser = await createBrowser();

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
  batch.map(async (work) => {
    const latest = productMap.get(work.product_id);

    // 一覧に存在しない作品は OLD へ移行
if (!latest) {
  const { error } = await supabase
    .from("works")
    .update({
      stage: "OLD",
    })
    .eq("product_id", work.product_id);

  if (error) {
    console.error(
      `[ERROR] Stage更新失敗 ${work.product_id}`,
      error
    );
    return;
  }

  console.log(
    `[STAGE] ${work.product_id} SEMI_NEW → OLD`
  );

  return;
}
    const dbPrice =
      work.sale_price ?? work.list_price;

    const latestPrice =
      latest.salePrice ?? latest.listPrice;

    // 価格変更なし
    if (
      dbPrice != null &&
      latestPrice != null &&
      dbPrice === latestPrice
    ) {
      console.log(
        `[SKIP] ${work.product_id} price=${dbPrice}`
      );
      return;
    }

    console.log(
      `[UPDATE] ${work.product_id} ${dbPrice} → ${latestPrice}`
    );

    try {
      await updateWork(
  work.product_id,
  null,
  browser,
  latest.listPrice
);
    } catch (error) {
      console.error(
        `[ERROR] update失敗 ${work.product_id}`,
        error
      );
    }
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
} finally {
  await closeBrowser(browser);
}
}