import { UPDATE_CONFIG } from "@/config/update";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { Browser } from "playwright-core";
import { updateWorkDetailed } from "./updateWork";
import {
  ENDED_SALE_RUN_TIME_BUDGET_MS,
  ENDED_SALE_MAX_TARGETS_PER_RUN,
  processEndedSaleBatches,
} from "./endedSaleBatch";
import {
  classifyEndedSaleRemaining,
  selectEndedSaleFinalRetryTargets,
  summarizeEndedSaleOutcomes,
} from "./endedSaleOutcome";

type EndedSaleTarget = {
  product_id: string;
  sale_end_at: string | null;
  playwright_status: string | null;
};

type EndedSaleUpdateTarget = Pick<EndedSaleTarget, "product_id" | "playwright_status">;

type EndedSaleRunState = {
  browser: Browser;
  processed: number;
  updated: number;
  deferred: number;
  unchanged: number;
  failedProductIds: Set<string>;
  failedTargets: Map<string, EndedSaleTarget>;
  processedProductIds: Set<string>;
  updatedWorkIds: Set<string>;
};

async function updateBatch(batch: EndedSaleUpdateTarget[], browser: Browser) {
  return Promise.all(
    batch.map(async (work) => {
      console.log(`■ 終了セール更新開始 ${work.product_id}`);

      try {
        const result = await updateWorkDetailed(
          work.product_id,
          undefined,
          browser,
          undefined,
          { unavailableMode: "record" },
        );
        console.log(`[ENDED_SALE_RESULT] ${work.product_id} ${result.status}`);
        return { productId: work.product_id, result };
      } catch (error) {
        console.error(`✗ 更新失敗 ${work.product_id}`, error);
        return { productId: work.product_id, error: true as const };
      }
    }),
  );
}

async function processEndedSalePage(page: EndedSaleTarget[], state: EndedSaleRunState, runStartedAt: number, totalCount: number) {
  for (let index = 0; index < page.length; index += UPDATE_CONFIG.parallel) {
    if (Date.now() - runStartedAt >= ENDED_SALE_RUN_TIME_BUDGET_MS) {
      throw new Error("終了セール更新が実行時間上限に達しました");
    }

    const batch = page.slice(index, index + UPDATE_CONFIG.parallel);
    for (const work of batch) state.processedProductIds.add(work.product_id);
    const results = await updateBatch(batch, state.browser);

    const summary = summarizeEndedSaleOutcomes(
      results
        .filter((result): result is Extract<typeof result, { result: unknown }> => "result" in result)
        .map((result) => result.result.status),
    );
    state.updated += summary.updated;
    state.deferred += summary.deferred;
    state.unchanged += summary.unchanged;

    for (const result of results) {
      if ("error" in result) {
        state.failedProductIds.add(result.productId);
        const failedTarget = batch.find((work) => work.product_id === result.productId);
        if (failedTarget) state.failedTargets.set(result.productId, failedTarget);
        continue;
      }
      if (result.result.status === "updated") state.updatedWorkIds.add(result.productId);
    }

    state.processed += batch.length;
    await updateJob(
      JOBS.ENDED_SALE,
      state.processed,
      batch.at(-1)?.product_id ?? "",
    );

    if (state.processed % UPDATE_CONFIG.browserRestartInterval === 0) {
      await closeBrowser(state.browser);
      state.browser = await createBrowser();
    }

    console.log(
      `${state.processed}/${totalCount} updated=${state.updated} deferred=${state.deferred} ` +
        `unchanged=${state.unchanged} failed=${state.failedProductIds.size}`,
    );
  }
}

async function retryFailedEndedSaleTargets(state: EndedSaleRunState) {
  if (state.failedProductIds.size === 0) return;
  console.log(`失敗した${state.failedProductIds.size}件を再試行します`);
  await closeBrowser(state.browser);
  state.browser = await createBrowser();

  const targets = [...state.failedTargets.values()];
  for (let index = 0; index < targets.length; index += UPDATE_CONFIG.parallel) {
    const batch = targets.slice(index, index + UPDATE_CONFIG.parallel);
    const results = await updateBatch(batch, state.browser);
    const summary = summarizeEndedSaleOutcomes(
      results
        .filter((result): result is Extract<typeof result, { result: unknown }> => "result" in result)
        .map((result) => result.result.status),
    );
    state.updated += summary.updated;
    state.deferred += summary.deferred;
    state.unchanged += summary.unchanged;

    for (const result of results) {
      if ("error" in result) continue;
      state.failedProductIds.delete(result.productId);
      state.failedTargets.delete(result.productId);
      if (result.result.status === "updated") state.updatedWorkIds.add(result.productId);
    }
  }
}

async function loadEndedSaleRemainingTargets(now: string) {
  const remainingTargets: EndedSaleTarget[] = [];
  let afterProductId: string | null = null;
  while (true) {
    let query = supabase
      .from("works")
      .select("product_id, sale_end_at, is_on_sale, playwright_status")
      .not("sale_end_at", "is", null)
      .eq("is_on_sale", true)
      .lte("sale_end_at", now)
      .order("product_id")
      .limit(ENDED_SALE_MAX_TARGETS_PER_RUN);
    if (afterProductId !== null) query = query.gt("product_id", afterProductId);

    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as EndedSaleTarget[];
    if (page.length === 0) break;
    const nextProductId = page.at(-1)?.product_id;
    if (!nextProductId || nextProductId === afterProductId) {
      throw new Error("終了セール更新の残件ページングカーソルが進みませんでした");
    }
    remainingTargets.push(...page);
    afterProductId = nextProductId;
  }
  return remainingTargets;
}

async function retryAndClassifyFinalEndedSaleTargets(
  remainingTargets: EndedSaleTarget[],
  state: EndedSaleRunState,
  now: string,
  runStartedAt: number,
) {
  let classification = classifyEndedSaleRemaining(remainingTargets, state.processedProductIds);
  const retryTargets = [
    ...selectEndedSaleFinalRetryTargets(classification.fatal, state.processedProductIds),
    ...classification.deferred,
  ];
  if (retryTargets.length === 0) return classification;
  if (Date.now() - runStartedAt >= ENDED_SALE_RUN_TIME_BUDGET_MS) {
    throw new Error("終了セール更新が実行時間上限に達しました");
  }

  console.log(
    `最終確認で残った${retryTargets.length}件を1回再処理します: ` +
      retryTargets.map((target) => target.product_id).join(", "),
  );
  await closeBrowser(state.browser);
  state.browser = await createBrowser();

  for (let index = 0; index < retryTargets.length; index += UPDATE_CONFIG.parallel) {
    if (Date.now() - runStartedAt >= ENDED_SALE_RUN_TIME_BUDGET_MS) {
      throw new Error("終了セール更新が実行時間上限に達しました");
    }
    const batch = retryTargets.slice(index, index + UPDATE_CONFIG.parallel);
    const results = await updateBatch(batch, state.browser);
    const summary = summarizeEndedSaleOutcomes(
      results
        .filter((result): result is Extract<typeof result, { result: unknown }> => "result" in result)
        .map((result) => result.result.status),
    );
    state.updated += summary.updated;
    state.deferred += summary.deferred;
    state.unchanged += summary.unchanged;
    for (const result of results) {
      if ("result" in result && result.result?.status === "updated") {
        state.updatedWorkIds.add(result.productId);
      }
    }
    console.log(
      `最終残件再処理 ${Math.min(index + batch.length, retryTargets.length)}/` +
        `${retryTargets.length}`,
    );
  }

  const refreshedTargets = await loadEndedSaleRemainingTargets(now);
  classification = classifyEndedSaleRemaining(refreshedTargets, state.processedProductIds);
  return classification;
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

  const state: EndedSaleRunState = {
    browser: await createBrowser(),
    processed: job.processed_count ?? 0,
    updated: 0,
    deferred: 0,
    unchanged: 0,
    failedProductIds: new Set<string>(),
    failedTargets: new Map<string, EndedSaleTarget>(),
    processedProductIds: new Set<string>(),
    updatedWorkIds: new Set<string>(),
  };
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

  try {
    await processEndedSaleBatches(
      loadPage,
      (page) => processEndedSalePage(page, state, runStartedAt, totalCount),
    );

    await retryFailedEndedSaleTargets(state);

    if (state.failedProductIds.size > 0) {
      const failedIds = [...state.failedProductIds];
      throw new Error(
        `終了セール更新に失敗した作品が${failedIds.length}件残りました: ${failedIds.join(", ")}`,
      );
    }

    const remainingTargets = await loadEndedSaleRemainingTargets(now);

    // A no-price result can be transient. Recheck already-processed unavailable
    // items once in this run, alongside fatal leftovers, before deferring them
    // to a later day. The final database query remains authoritative.
    const remainingClassification = await retryAndClassifyFinalEndedSaleTargets(
      remainingTargets,
      state,
      now,
      runStartedAt,
    );
    const { deferred: remainingDeferred, fatal } = remainingClassification;
    if (fatal.length > 0) {
      throw new Error(
        `終了セール更新が一部未処理です（未処理または要確認分類外${fatal.length}件）。次回実行で再開してください` +
          `: ${fatal.slice(0, 20).map((target) => target.product_id).join(", ")}`,
      );
    }

    const deferredMessage = remainingDeferred.length > 0
      ? `INFO: FANZA側で価格を確認できなかった${remainingDeferred.length}件は、誤って配信終了にしないため別日で自動再確認中です。対象: ${remainingDeferred
          .slice(0, 20)
          .map((target) => target.product_id)
          .join(", ")}${remainingDeferred.length > 20 ? " …" : ""}`
      : null;
    await finishJob(JOBS.ENDED_SALE, deferredMessage);
    console.log(
      `終了セール更新完了: ${state.processed}件（開始時点対象${totalCount}件）` +
        (deferredMessage ? ` / 別日で自動再確認中${remainingDeferred.length}件` : ""),
    );
    return {
      workIds: [...state.updatedWorkIds],
      processedCount: state.processed,
      totalCount,
      updatedCount: state.updated,
      deferredCount: remainingDeferred.length,
      failedCount: state.failedProductIds.size,
      unchangedCount: state.unchanged,
      deferredProductIds: remainingDeferred.slice(0, 20).map((target) => target.product_id),
    };
  } catch (error) {
    await failJob(
      JOBS.ENDED_SALE,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    await closeBrowser(state.browser);
  }
}
