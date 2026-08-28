import type { Browser } from "playwright-core";

import { UPDATE_CONFIG } from "@/config/update";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import {
  beginJob,
  failJob,
  finishJob,
  JOBS,
  updateJob,
} from "@/lib/jobs";
import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";
import { getNewItems } from "@/lib/playwright/getNewItems";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { saveDmmItem } from "./save";
import { restoreDiscontinuedWorks } from "./restoreDiscontinuedWorks";
import { updateWork } from "./updateWork";

type NewProduct = Awaited<ReturnType<typeof getNewItems>>["products"][number];

type NewWork = {
  product_id: string;
  release_date: string;
  list_price: number | null;
  sale_price: number | null;
  playwright_status: string | null;
};

async function loadAllProductIds(): Promise<Set<string>> {
  const productIds = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id")
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    for (const work of data ?? []) {
      if (work.product_id) productIds.add(work.product_id);
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return productIds;
}

async function loadNewWorks(): Promise<NewWork[]> {
  const works: NewWork[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "product_id, release_date, list_price, sale_price, playwright_status",
      )
      .eq("stage", "NEW")
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    works.push(...data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return works;
}

async function registerMissingNewWorks(
  products: NewProduct[],
  browser: Browser,
): Promise<void> {
  const existingIds = await loadAllProductIds();
  const missingProducts = products.filter(
    (product) => !existingIds.has(product.productId),
  );

  if (missingProducts.length === 0) {
    console.log("[NEW_REGISTER] 未登録作品はありません");
    return;
  }

  console.log(`[NEW_REGISTER] 未登録${missingProducts.length}件を登録します`);

  for (let i = 0; i < missingProducts.length; i += UPDATE_CONFIG.parallel) {
    const batch = missingProducts.slice(i, i + UPDATE_CONFIG.parallel);

    await Promise.all(
      batch.map(async (product) => {
        const item = await getDmmItem(product.productId);

        if (!item) {
          console.warn(`[NEW_REGISTER_SKIP] DMM API未取得 ${product.productId}`);
          return;
        }

        const saved = await saveDmmItem(item, undefined, "NEW");

        if (!saved) {
          console.warn(
            `[NEW_REGISTER_SKIP] DB登録失敗または登録済み ${product.productId}`,
          );
          return;
        }

        try {
          await updatePlaywrightItem(
            product.productId,
            item.URL ?? item.affiliateURL,
            browser,
            product.listPrice,
            { captureSampleMovie: true },
          );
          console.log(`[NEW_REGISTER_OK] ${product.productId}`);
        } catch (error) {
          // The row remains PENDING. A later normal pass can complete pricing,
          // but sample movie discovery is intentionally limited to this insert.
          console.error(
            `[NEW_REGISTER_PLAYWRIGHT_ERROR] ${product.productId}`,
            error,
          );
        }
      }),
    );

    console.log(
      `[NEW_REGISTER] ${Math.min(i + batch.length, missingProducts.length)}/${missingProducts.length}`,
    );
  }
}

export async function updateNewWorks() {
  const { products } = await getNewItems();
  const productMap = new Map(
    products.map((product) => [product.productId, product]),
  );

  let browser = await createBrowser();
  let jobStarted = false;

  try {
    await restoreDiscontinuedWorks(
      products.map((product) => product.productId),
      "NEW",
    );

    // Restore the original new-work sync: register missing FANZA products via
    // DMM API, then use Playwright once to capture every price variation.
    await registerMissingNewWorks(products, browser);

    // Start the regular update pass with a fresh browser after registration.
    await closeBrowser(browser);
    browser = await createBrowser();

    const works = await loadNewWorks();

    if (works.length === 0) {
      console.log("更新対象の新作はありません");
      return;
    }

    const job = await beginJob(JOBS.NEW_UPDATE, works.length);
    jobStarted = true;

    const processedCount = job.processed_count ?? 0;
    const targets = works.slice(processedCount);
    let current = processedCount;

    console.log(
      `新作更新開始 (${processedCount}/${works.length}から再開)`,
    );

    for (let i = 0; i < targets.length; i += UPDATE_CONFIG.parallel) {
      const batch = targets.slice(i, i + UPDATE_CONFIG.parallel);

      await Promise.all(
        batch.map(async (work) => {
          const latest = productMap.get(work.product_id);

          if (!latest) {
            const { error } = await supabase
              .from("works")
              .update({ stage: "SEMI_NEW" })
              .eq("product_id", work.product_id);

            if (error) throw error;

            console.log(`[STAGE] ${work.product_id} NEW → SEMI_NEW`);
            return;
          }

          const dbPrice = work.sale_price ?? work.list_price;
          const latestPrice = latest.salePrice ?? latest.listPrice;

          // PENDING means initial Playwright completion is still required even
          // when the headline price already matches the listing page.
          if (
            work.playwright_status !== "PENDING" &&
            !work.playwright_status?.startsWith("UNAVAILABLE_") &&
            dbPrice != null &&
            latestPrice != null &&
            dbPrice === latestPrice
          ) {
            console.log(`[SKIP] ${work.product_id} price=${dbPrice}`);
            return;
          }

          console.log(
            `[UPDATE] ${work.product_id} ${dbPrice} → ${latestPrice}`,
          );

          try {
            await updateWork(
              work.product_id,
              null,
              browser,
              latest.listPrice,
            );
          } catch (error) {
            console.error(`[ERROR] update失敗 ${work.product_id}`, error);
          }
        }),
      );

      current += batch.length;

      if (current % UPDATE_CONFIG.browserRestartInterval === 0) {
        console.log(`🔄 Browser再起動 (${current}件処理)`);
        await closeBrowser(browser);
        browser = await createBrowser();
      }

      const lastWork = batch[batch.length - 1];
      await updateJob(JOBS.NEW_UPDATE, current, lastWork.product_id);

      console.log(`${current}/${works.length}`);
    }

    await finishJob(JOBS.NEW_UPDATE);
    console.log("新作更新完了");
  } catch (error) {
    console.error("updateNewWorks エラー:", error);

    if (jobStarted) {
      await failJob(
        JOBS.NEW_UPDATE,
        error instanceof Error ? error.message : String(error),
      );
    }

    throw error;
  } finally {
    await closeBrowser(browser);
  }
}
