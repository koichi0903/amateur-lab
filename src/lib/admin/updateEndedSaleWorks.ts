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
import { classifyEndedSaleRemaining } from "./endedSaleOutcome";

type EndedSaleTarget = {
  product_id: string;
  sale_end_at: string | null;
  playwright_status: string | null;
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
  const processedProductIds = new Set<string>();
  const updatedWorkIds = new Set<string>();
  const runStartedAt = Date.now();

  const loadPage = async (afterProductId: string | null) => {
    let query = supabase
      .from("works")
      .select("product_id, sale_end_at, is_on_sale, playwright_status")
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
      for (const work of batch) processedProductIds.add(work.product_id);
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

    const remainingTargets: EndedSaleTarget[] = [];
    let remainingAfterProductId: string | null = null;
    while (true) {
      let remainingQuery = supabase
        .from("works")
        .select("product_id, sale_end_at, is_on_sale, playwright_status")
        .not("sale_end_at", "is", null)
        .eq("is_on_sale", true)
        .lte("sale_end_at", now)
        .order("product_id")
        .limit(ENDED_SALE_MAX_TARGETS_PER_RUN);

      if (remainingAfterProductId !== null) {
        remainingQuery = remainingQuery.gt("product_id", remainingAfterProductId);
      }

      const { data, error } = await remainingQuery;
      if (error) throw error;
      const page = (data ?? []) as EndedSaleTarget[];
      if (page.length === 0) break;

      const nextProductId = page.at(-1)?.product_id;
      if (!nextProductId || nextProductId === remainingAfterProductId) {
        throw new Error("終了セール更新の残件ページングカーソルが進みませんでした");
      }
      remainingTargets.push(...page);
      remainingAfterProductId = nextProductId;
    }

    const { deferred, fatal } = classifyEndedSaleRemaining(
      remainingTargets,
      processedProductIds,
    );
    if (fatal.length > 0) {
      throw new Error(
        `終了セール更新が一部未処理です（未処理または要確認分類外${fatal.length}件）。次回実行で再開してください` +
          `: ${fatal.slice(0, 20).map((target) => target.product_id).join(", ")}`,
      );
    }

    const warningMessage = deferred.length > 0
      ? `終了セール更新完了（要再確認${deferred.length}件）。利用不可確認待ち: ${deferred
          .slice(0, 20)
          .map((target) => target.product_id)
          .join(", ")}${deferred.length > 20 ? " …" : ""}`
      : null;
    await finishJob(JOBS.ENDED_SALE, warningMessage);
    console.log(
      `終了セール更新完了: ${processed}件（開始時点対象${totalCount}件）` +
        (warningMessage ? ` / 要再確認${deferred.length}件` : ""),
    );
    return {
      workIds: [...updatedWorkIds],
      processedCount: processed,
      totalCount,
      deferredCount: deferred.length,
      deferredProductIds: deferred.slice(0, 20).map((target) => target.product_id),
    };
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
