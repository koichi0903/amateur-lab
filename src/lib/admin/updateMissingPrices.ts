import type { Browser } from "playwright-core";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { UPDATE_CONFIG } from "@/config/update";
import { updateWork } from "./updateWork";
import { createBrowser, closeBrowser } from "@/lib/playwright/browserManager";
import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

type PriceTarget = {
  id: number;
  product_id: string;
  price: number | null;
  list_price: number | null;
};

const PAGE_SIZE = 1000;

async function loadPriceTargets(): Promise<PriceTarget[]> {
  const works: PriceTarget[] = [];
  const productsWithPricePlans = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("work_prices")
      .select("id,product_id")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    for (const row of data ?? []) productsWithPricePlans.add(row.product_id);
    if (!data || data.length < PAGE_SIZE) break;
  }

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("works")
      .select("id,product_id,price,list_price")
      .neq("stage", "DISCONTINUED")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    for (const work of data ?? []) {
      if (
        work.price == null ||
        work.price <= 0 ||
        work.list_price == null ||
        work.list_price <= 0 ||
        !productsWithPricePlans.has(work.product_id)
      ) {
        works.push(work);
      }
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return works;
}

async function updateBatch(
  batch: PriceTarget[],
  browser: Browser
): Promise<PriceTarget[]> {
  const results = await Promise.allSettled(
    batch.map((work) => updateWork(work.product_id, undefined, browser))
  );

  return batch.filter((work, index) => {
    const result = results[index];
    if (result.status === "rejected") {
      console.error("[missing-prices] 更新失敗", {
        productId: work.product_id,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
      return true;
    }
    return false;
  });
}

export async function updateMissingPrices() {
  let browser: Browser | null = null;

  try {
    // 完了した作品は条件から外れるため、再開時に processed_count で
    // 再度sliceしない。現在残っている対象をID順に処理する。
    const targets = await loadPriceTargets();
    const job = await beginJob(JOBS.MISSING_PRICES, targets.length);
    let processed = job.processed_count ?? 0;

    console.log(`[missing-prices] 現在の補完対象 ${targets.length}件`);

    if (targets.length === 0) {
      await finishJob(JOBS.MISSING_PRICES);
      return { count: 0, updated: 0 };
    }

    browser = await createBrowser();
    const batchSize = UPDATE_CONFIG.parallel;
    let updated = 0;
    const failedProductIds: string[] = [];
    let nextBrowserRestart =
      (Math.floor(processed / UPDATE_CONFIG.browserRestartInterval) + 1) *
      UPDATE_CONFIG.browserRestartInterval;

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      let failed = await updateBatch(batch, browser);

      if (failed.length > 0) {
        console.warn(
          `[missing-prices] ${failed.length}件をブラウザ再起動後に再試行します`
        );
        await closeBrowser(browser);
        browser = await createBrowser();
        failed = await updateBatch(failed, browser);
      }

      const succeeded = batch.length - failed.length;
      processed += batch.length;
      updated += succeeded;
      failedProductIds.push(...failed.map((work) => work.product_id));

      await updateJob(
        JOBS.MISSING_PRICES,
        processed,
        batch[batch.length - 1].product_id
      );

      console.log(
        `[missing-prices] 処理${processed}/${targets.length} 成功${updated} 失敗${failedProductIds.length}`
      );

      if (failed.length > 0) {
        console.warn(
          `[missing-prices] 失敗を記録して後続作品を継続します: ${failed
            .map((work) => work.product_id)
            .join(", ")}`
        );
      }

      if (i + batch.length < targets.length && processed >= nextBrowserRestart) {
        await closeBrowser(browser);
        browser = await createBrowser();
        nextBrowserRestart += UPDATE_CONFIG.browserRestartInterval;
      }
    }

    if (failedProductIds.length > 0) {
      throw new Error(
        `価格補完は全対象を処理しましたが${failedProductIds.length}件失敗しました: ${failedProductIds.join(", ")}`
      );
    }

    await finishJob(JOBS.MISSING_PRICES);
    return { count: targets.length, updated };
  } catch (error) {
    await failJob(
      JOBS.MISSING_PRICES,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
