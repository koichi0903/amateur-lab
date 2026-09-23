import { UPDATE_CONFIG } from "@/config/update";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { Browser } from "playwright-core";
import { updateWork } from "./updateWork";
import {
  ENDED_SALE_RUN_TIME_BUDGET_MS,
  ENDED_SALE_MAX_TARGETS_PER_RUN,
  processEndedSaleBatches,
} from "./endedSaleBatch";

type EndedSaleTarget = {
  product_id: string;
  sale_end_at: string | null;
};

async function updateBatch(batch: EndedSaleTarget[], browser: Browser) {
  return Promise.all(
    batch.map(async (work) => {
      console.log(`■ 終了セール更新開始 ${work.product_id}`);

      try {
        const changed = await updateWork(work.product_id, undefined, browser);
        console.log(`✓ 更新成功 ${work.product_id}`);
        return { productId: work.product_id, success: true as const, changed };
      } catch (error) {
        console.error(`✗ 更新失敗 ${work.product_id}`, error);
        return { productId: work.product_id, success: false as const };
      }
    }),
  );
}

export async function updateEndedSaleWorks() {
  const now = new Date().toISOString();
  const { count: initialTargetCount, error: countError } = await supabase
    .from("works")
    .select("product_id", { count: "exact", head: true })
    .not("sale_end_at", "is", null)
    .eq("is_on_sale", true)
    .lte("sale_end_at", now);

  if (countError) throw countError;

  const totalCountAtStart = initialTargetCount ?? 0;
  const job = await beginJob(JOBS.ENDED_SALE, totalCountAtStart);
  const totalCount = job.total_count ?? totalCountAtStart;

  if (totalCountAtStart === 0) {
    await finishJob(JOBS.ENDED_SALE);
    console.log("終了日時を過ぎたセール作品 0件");
    return { workIds: [] as string[], processedCount: 0, totalCount: 0 };
  }

  console.log(
    `終了日時を過ぎたセール作品 ${totalCountAtStart}件` +
      `（1ページ上限${ENDED_SALE_MAX_TARGETS_PER_RUN}件、開始時点count）`,
  );

  let browser = await createBrowser();
  let processed = job.processed_count ?? 0;
  let succeeded = 0;
  const failedProductIds = new Set<string>();
  const failedTargets = new Map<string, EndedSaleTarget>();
  const updatedWorkIds = new Set<string>();
  const runStartedAt = Date.now();

  const loadPage = async (afterProductId: string | null) => {
    let query = supabase
      .from("works")
      .select("product_id, sale_end_at, is_on_sale")
      .not("sale_end_at", "is", null)
      .eq("is_on_sale", true)
      .lte("sale_end_at", now)
      .order("product_id")
      .limit(ENDED_SALE_MAX_TARGETS_PER_RUN);

    if (afterProductId !== null) {
      query = query.gt("product_id", afterProductId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as EndedSaleTarget[];
  };

  const processPage = async (page: EndedSaleTarget[]) => {
    for (let index = 0; index < page.length; index += UPDATE_CONFIG.parallel) {
      if (Date.now() - runStartedAt >= ENDED_SALE_RUN_TIME_BUDGET_MS) {
        throw new Error("終了セール更新が実行時間上限に達しました");
      }

      const batch = page.slice(index, index + UPDATE_CONFIG.parallel);
      const results = await updateBatch(batch, browser);

      for (const result of results) {
        if (result.success) succeeded += 1;
        else {
          failedProductIds.add(result.productId);
          const failedTarget = batch.find((work) => work.product_id === result.productId);
          if (failedTarget) failedTargets.set(result.productId, failedTarget);
        }
        if (result.success && result.changed) updatedWorkIds.add(result.productId);
      }

      processed += batch.length;
      await updateJob(
        JOBS.ENDED_SALE,
        processed,
        batch.at(-1)?.product_id ?? "",
      );

      if (processed % UPDATE_CONFIG.browserRestartInterval === 0) {
        await closeBrowser(browser);
        browser = await createBrowser();
      }

      console.log(
        `${processed}/${totalCount} success=${succeeded} failed=${failedProductIds.size}`,
      );
    }
  };

  try {
    await processEndedSaleBatches(loadPage, processPage);

    if (failedProductIds.size > 0) {
      console.log(`失敗した${failedProductIds.size}件を再試行します`);
      await closeBrowser(browser);
      browser = await createBrowser();

      const retryBatchTargets = [...failedTargets.values()];

      for (let index = 0; index < retryBatchTargets.length; index += UPDATE_CONFIG.parallel) {
        const batch = retryBatchTargets.slice(index, index + UPDATE_CONFIG.parallel);
        const results = await updateBatch(batch, browser);

        for (const result of results) {
          if (result.success) {
            failedProductIds.delete(result.productId);
            failedTargets.delete(result.productId);
          }
          if (result.success && result.changed) updatedWorkIds.add(result.productId);
        }
      }
    }

    if (failedProductIds.size > 0) {
      const failedIds = [...failedProductIds];
      throw new Error(
        `終了セール更新に失敗した作品が${failedIds.length}件残りました: ${failedIds.join(", ")}`,
      );
    }

    const { count: remainingCount, error: remainingCountError } = await supabase
      .from("works")
      .select("product_id", { count: "exact", head: true })
      .not("sale_end_at", "is", null)
      .eq("is_on_sale", true)
      .lte("sale_end_at", now);

    if (remainingCountError) throw remainingCountError;
    if ((remainingCount ?? 0) > 0) {
      throw new Error(
        `終了セール更新が一部未処理です（残り${remainingCount}件）。次回実行で再開してください`,
      );
    }

    await finishJob(JOBS.ENDED_SALE);
    console.log(`終了セール更新完了: ${processed}件（開始時点対象${totalCount}件）`);
    return { workIds: [...updatedWorkIds], processedCount: processed, totalCount };
  } catch (error) {
    await failJob(
      JOBS.ENDED_SALE,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    await closeBrowser(browser);
  }
}
