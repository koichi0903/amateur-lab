import { UPDATE_CONFIG } from "@/config/update";
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
import { getSemiNewItems } from "@/lib/playwright/getSemiNewItems";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { updateWork } from "./updateWork";
import { restoreDiscontinuedWorks } from "./restoreDiscontinuedWorks";

const DETAIL_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

type SemiNewWork = {
  product_id: string;
  price: number | null;
  list_price: number | null;
  sale_price: number | null;
  url: string | null;
  playwright_status: string | null;
  updated_at: string | null;
};

async function loadSemiNewWorks(): Promise<SemiNewWork[]> {
  const works: SemiNewWork[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "product_id, price, list_price, sale_price, url, playwright_status, updated_at",
      )
      .eq("stage", "SEMI_NEW")
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    works.push(...data);
    if (data.length < pageSize) break;
  }

  return works;
}

function needsScheduledRefresh(updatedAt: string | null): boolean {
  if (!updatedAt) return true;

  const updatedAtMs = Date.parse(updatedAt);
  return (
    !Number.isFinite(updatedAtMs) ||
    Date.now() - updatedAtMs >= DETAIL_REFRESH_INTERVAL_MS
  );
}

function hasRequiredDataMissing(work: SemiNewWork): boolean {
  return (
    !work.url ||
    work.price == null ||
    work.list_price == null ||
    !work.playwright_status
  );
}

export async function updateSemiNewWorks() {
  const { products, totalPages } = await getSemiNewItems();

  // An empty scrape must never move every SEMI_NEW row to OLD.
  if (products.length === 0) {
    throw new Error(
      `準新作一覧を取得できませんでした（検出ページ数: ${totalPages}）`,
    );
  }

  await restoreDiscontinuedWorks(
    products.map((product) => product.productId),
    "SEMI_NEW",
  );

  const works = await loadSemiNewWorks();

  console.log("準新作取得件数:", works.length);

  if (works.length === 0) {
    console.log("更新対象の準新作はありません");
    return;
  }

  const productMap = new Map(
    products.map((product) => [product.productId, product]),
  );

  const job = await beginJob(JOBS.SEMI_NEW, works.length);
  const processedCount = job.processed_count ?? 0;
  const targets = works.slice(processedCount);

  console.log(
    `準新作更新開始 (${processedCount}/${works.length}から再開)`,
  );

  let browser = await createBrowser();

  try {
    for (let i = 0; i < targets.length; i += UPDATE_CONFIG.parallel) {
      const batch = targets.slice(i, i + UPDATE_CONFIG.parallel);

      await Promise.all(
        batch.map(async (work) => {
          const latest = productMap.get(work.product_id);

          if (!latest) {
            try {
              // Capture the final DMM/Playwright state before archiving it.
              await updateWork(work.product_id, null, browser, null);

              const { error } = await supabase
                .from("works")
                .update({ stage: "OLD" })
                .eq("product_id", work.product_id);

              if (error) throw error;

              console.log(`[STAGE] ${work.product_id} SEMI_NEW → OLD`);
            } catch (error) {
              // Keep SEMI_NEW so the final refresh can be retried next time.
              console.error(
                `[SEMI_NEW_FINAL_UPDATE_ERROR] ${work.product_id}`,
                error,
              );
            }
            return;
          }

          const dbPrice = work.sale_price ?? work.list_price ?? work.price;
          const latestPrice = latest.salePrice ?? latest.listPrice;
          const isPending = work.playwright_status === "PENDING";
          const isMissingData = hasRequiredDataMissing(work);
          const isPriceChanged =
            latestPrice != null && dbPrice !== latestPrice;
          const isWeeklyRefresh = needsScheduledRefresh(work.updated_at);

          if (
            !isPending &&
            !isMissingData &&
            !isPriceChanged &&
            !isWeeklyRefresh
          ) {
            console.log(
              `[SKIP] ${work.product_id} price=${dbPrice} detail<7days`,
            );
            return;
          }

          const reasons = [
            isPending ? "PENDING" : null,
            isMissingData ? "MISSING_DATA" : null,
            isPriceChanged ? "PRICE_CHANGED" : null,
            isWeeklyRefresh ? "WEEKLY_REFRESH" : null,
          ].filter((reason): reason is string => Boolean(reason));

          console.log(
            `[UPDATE] ${work.product_id} reasons=${reasons.join(",")}`,
          );

          try {
            await updateWork(
              work.product_id,
              null,
              browser,
              latest.listPrice,
            );
          } catch (error) {
            console.error(`[SEMI_NEW_UPDATE_ERROR] ${work.product_id}`, error);
          }
        }),
      );

      const processed = processedCount + i + batch.length;

      if (processed % UPDATE_CONFIG.browserRestartInterval === 0) {
        console.log(`🔄 Browser再起動 (${processed}件処理)`);
        await closeBrowser(browser);
        browser = await createBrowser();
      }

      await updateJob(
        JOBS.SEMI_NEW,
        processed,
        batch[batch.length - 1].product_id,
      );

      console.log(`${processed}/${works.length}`);
    }

    await finishJob(JOBS.SEMI_NEW);
    console.log("準新作更新完了");
  } catch (error) {
    await failJob(
      JOBS.SEMI_NEW,
      error instanceof Error ? error.message : String(error),
    );

    throw error;
  } finally {
    await closeBrowser(browser);
  }
}
