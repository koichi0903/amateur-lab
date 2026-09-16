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

function resolveRunLimit(totalCount: number): number {
  const configured = Number(process.env.MISSING_PRICE_BATCH_LIMIT);
  if (Number.isInteger(configured) && configured > 0) {
    return Math.min(configured, totalCount);
  }

  return process.env.VERCEL ? Math.min(20, totalCount) : totalCount;
}

async function loadPriceTargets(): Promise<PriceTarget[]> {
  const works: PriceTarget[] = [];
  const productsWithPricePlans = new Set<string>();
  const productsWithMissingPeriods = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("work_prices")
      .select("id,product_id,period")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    for (const row of data ?? []) {
      productsWithPricePlans.add(row.product_id);
      if (!row.period) productsWithMissingPeriods.add(row.product_id);
    }
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
        !productsWithPricePlans.has(work.product_id) ||
        productsWithMissingPeriods.has(work.product_id)
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
): Promise<{ failed: PriceTarget[]; changed: PriceTarget[] }> {
  const results = await Promise.allSettled(
    batch.map(async (work) => ({ work, changed: await updateWork(work.product_id, undefined, browser) }))
  );

  const failed: PriceTarget[] = [];
  const changed: PriceTarget[] = [];
  batch.forEach((work, index) => {
    const result = results[index];
    if (result.status === "rejected") {
      console.error("[missing-prices] 更新失敗", {
        productId: work.product_id,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
      failed.push(work);
      return;
    }
    if (result.value.changed) changed.push(work);
  });
  return { failed, changed };
}

export async function updateMissingPrices() {
  let browser: Browser | null = null;

  try {
    // 完了した作品は条件から外れるため、再開時に processed_count で
    // 再度sliceしない。現在残っている対象をID順に処理する。
    const allTargets = await loadPriceTargets();
    const targets = allTargets.slice(0, resolveRunLimit(allTargets.length));
    const job = await beginJob(JOBS.MISSING_PRICES, targets.length);
    let processed = job.processed_count ?? 0;

    console.log(
      `[missing-prices] 今回の補完対象 ${targets.length}件 / 未補完 ${allTargets.length}件`
    );

    if (targets.length === 0) {
      await finishJob(JOBS.MISSING_PRICES);
      return { count: 0, updated: 0, workIds: [] as string[] };
    }

    browser = await createBrowser();
    const batchSize = UPDATE_CONFIG.parallel;
    let updated = 0;
    const updatedWorkIds: string[] = [];
    const failedProductIds: string[] = [];
    let nextBrowserRestart =
      (Math.floor(processed / UPDATE_CONFIG.browserRestartInterval) + 1) *
      UPDATE_CONFIG.browserRestartInterval;

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      let batchResult = await updateBatch(batch, browser);
      let failed = batchResult.failed;

      if (failed.length > 0) {
        console.warn(
          `[missing-prices] ${failed.length}件をブラウザ再起動後に再試行します`
        );
        await closeBrowser(browser);
        browser = await createBrowser();
        const retryResult = await updateBatch(failed, browser);
        failed = retryResult.failed;
        batchResult = {
          failed,
          changed: [...batchResult.changed, ...retryResult.changed],
        };
      }

      const succeeded = batch.length - failed.length;
      processed += batch.length;
      updated += succeeded;
      updatedWorkIds.push(...batchResult.changed.map((work) => work.product_id));
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
    return { count: targets.length, updated, workIds: updatedWorkIds };
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
