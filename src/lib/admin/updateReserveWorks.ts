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
import { getReserveItems } from "@/lib/playwright/getReserveItems";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { saveDmmItem } from "./save";
import { restoreDiscontinuedWorks } from "./restoreDiscontinuedWorks";
import { updateWork } from "./updateWork";

type ReserveProduct = Awaited<
  ReturnType<typeof getReserveItems>
>["products"][number];

type ReservedWork = {
  product_id: string;
};

async function loadAllProductIds(): Promise<Set<string>> {
  const productIds = new Set<string>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
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
  }

  return productIds;
}

async function loadReservedWorks(): Promise<ReservedWork[]> {
  const works: ReservedWork[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id")
      .eq("stage", "RESERVED")
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    works.push(...data);
    if (data.length < pageSize) break;
  }

  return works;
}

async function registerMissingReservedWorks(
  products: ReserveProduct[],
  browser: Browser,
): Promise<void> {
  const existingIds = await loadAllProductIds();
  const missingProducts = products.filter(
    (product) => !existingIds.has(product.productId),
  );

  if (missingProducts.length === 0) {
    console.log("[RESERVE_REGISTER] 未登録作品はありません");
    return;
  }

  console.log(
    `[RESERVE_REGISTER] 未登録${missingProducts.length}件を登録します`,
  );

  for (let i = 0; i < missingProducts.length; i += UPDATE_CONFIG.parallel) {
    const batch = missingProducts.slice(i, i + UPDATE_CONFIG.parallel);

    await Promise.all(
      batch.map(async (product) => {
        try {
          const item = await getDmmItem(product.productId);

          if (!item) {
            console.warn(
              `[RESERVE_REGISTER_SKIP] DMM API未取得 ${product.productId}`,
            );
            return;
          }

          const saved = await saveDmmItem(item, undefined, "RESERVED");
          if (!saved) return;

          await updatePlaywrightItem(
            product.productId,
            item.URL ?? item.affiliateURL,
            browser,
            product.listPrice,
            { captureSampleMovie: true },
          );

          console.log(`[RESERVE_REGISTER_OK] ${product.productId}`);
        } catch (error) {
          // The row remains PENDING. A later normal pass can complete pricing,
          // but sample movie discovery is intentionally limited to this insert.
          console.error(
            `[RESERVE_REGISTER_ERROR] ${product.productId}`,
            error,
          );
        }
      }),
    );
  }
}

export async function updateReserveWorks() {
  const { products, totalPages } = await getReserveItems();

  // An empty scrape must never demote every RESERVED row to NEW.
  if (products.length === 0) {
    throw new Error(
      `予約作品一覧を取得できませんでした（検出ページ数: ${totalPages}）`,
    );
  }

  const productMap = new Map(
    products.map((product) => [product.productId, product]),
  );

  let browser = await createBrowser();
  let jobStarted = false;

  try {
    await restoreDiscontinuedWorks(
      products.map((product) => product.productId),
      "RESERVED",
    );

    await registerMissingReservedWorks(products, browser);

    // Registration and the regular pass use separate browser lifetimes.
    await closeBrowser(browser);
    browser = await createBrowser();

    const works = await loadReservedWorks();
    if (works.length === 0) {
      console.log("更新対象の予約作品はありません");
      return;
    }

    const job = await beginJob(JOBS.RESERVE, works.length);
    jobStarted = true;

    const processedCount = job.processed_count ?? 0;
    const targets = works.slice(processedCount);
    let current = processedCount;

    console.log(
      `予約作品更新開始 (${processedCount}/${works.length}から再開)`,
    );

    for (let i = 0; i < targets.length; i += UPDATE_CONFIG.parallel) {
      const batch = targets.slice(i, i + UPDATE_CONFIG.parallel);

      await Promise.all(
        batch.map(async (work) => {
          const latest = productMap.get(work.product_id);

          try {
            // Always refresh DMM details while a product is reserved. The
            // release date can move even when the headline price is unchanged.
            await updateWork(
              work.product_id,
              null,
              browser,
              latest?.listPrice ?? null,
            );

            if (!latest) {
              const { error } = await supabase
                .from("works")
                .update({ stage: "NEW" })
                .eq("product_id", work.product_id);

              if (error) throw error;

              console.log(`[STAGE] ${work.product_id} RESERVED → NEW`);
            } else {
              console.log(`[RESERVE_UPDATE_OK] ${work.product_id}`);
            }
          } catch (error) {
            console.error(`[RESERVE_UPDATE_ERROR] ${work.product_id}`, error);
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
      await updateJob(JOBS.RESERVE, current, lastWork.product_id);
      console.log(`${current}/${works.length}`);
    }

    await finishJob(JOBS.RESERVE);
    console.log("予約作品更新完了");
  } catch (error) {
    console.error("updateReserveWorks エラー:", error);

    if (jobStarted) {
      await failJob(
        JOBS.RESERVE,
        error instanceof Error ? error.message : String(error),
      );
    }

    throw error;
  } finally {
    await closeBrowser(browser);
  }
}
