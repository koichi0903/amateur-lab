import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";
import { notifyAmateurMakerAlertsForContentIds, notifyAmateurPriceAlertsForContentIds } from "@/lib/pushNotifications";
import { buildFanzaAmateurApiCatalogPageProgress, splitFanzaAmateurApiDateRange } from "@/lib/dmm/fanzaAmateurApiCatalogRange";
import { buildFanzaAmateurApiPopularityPagePlan } from "@/lib/dmm/fanzaAmateurApiPopularityRank";
import { buildFanzaAmateurWeeklyPriceSnapshotRows } from "@/lib/dmm/fanzaAmateurWeeklyPriceSnapshots";
import { catalogContentIds, catalogItemChangeIds, countInvalidCatalogContentIds, observedCatalogItemKeyPaths } from "@/lib/dmm/fanzaAmateurApiCatalogPage";
import { fetchFanzaAmateurApiItemListPage, safeFanzaAmateurApiError } from "@/lib/dmm/fanzaAmateurApiItemListRequest";

const PAGE_SIZE = 100;
const API_OFFSET_LIMIT = 5_000;
const API_RANGE_LIMIT = 5_000;
const POPULARITY_RANK_LIMIT = 5_000;
const DAILY_PRICE_HISTORY_BATCH_SIZE = 1_000;
const RUN_FIELDS = "id,status,run_type,source_sort,total_count,next_offset,fetched_item_count,observed_item_key_paths,last_error,started_at,updated_at,completed_at,pending_ranges,current_range,expected_item_count,completed_range_count,range_count,rank_next_offset,rank_fetched_item_count,rank_total_count,rank_snapshot_at";

export type FanzaAmateurRunType = "daily_incremental" | "weekly_full";
type DateRange = { fromDate: string; toDate: string };
type ActiveDateRange = DateRange & { offset: number; expectedCount: number | null };
type ApiItem = Record<string, unknown> & { content_id?: unknown };
export type FanzaAmateurApiCatalogRun = {
  id: string;
  status: "running" | "completed" | "limit_reached" | "needs_attention" | "failed";
  run_type: FanzaAmateurRunType;
  source_sort: "date";
  total_count: number | null;
  next_offset: number;
  fetched_item_count: number;
  observed_item_key_paths: string[];
  last_error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  pending_ranges: DateRange[];
  current_range: ActiveDateRange | null;
  expected_item_count: number;
  completed_range_count: number;
  range_count: number;
  rank_next_offset: number;
  rank_fetched_item_count: number;
  rank_total_count: number | null;
  rank_snapshot_at: string | null;
};

function asCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

async function fetchApiPage(range: DateRange, offset: number) {
  const { response, payload, rawItems } = await fetchFanzaAmateurApiItemListPage({
    offset,
    hits: PAGE_SIZE,
    sort: "date",
    range,
  });
  if (!response.ok || String(payload.result?.status ?? "200") !== "200" || !Array.isArray(rawItems)) {
    throw new Error(safeFanzaAmateurApiError(response.status, payload));
  }
  return { payload, rawItems: rawItems as ApiItem[] };
}

export async function getActiveFanzaAmateurApiCatalogRun() {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .select(RUN_FIELDS)
    .eq("status", "running")
    .maybeSingle();
  if (error) throw new Error(`素人API取得状況を読めませんでした: ${error.message}`);
  return data as FanzaAmateurApiCatalogRun | null;
}

export async function getLatestFanzaAmateurApiCatalogRun(runType?: FanzaAmateurRunType) {
  let query = supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .select(RUN_FIELDS)
    .order("started_at", { ascending: false })
    .limit(1);
  if (runType) query = query.eq("run_type", runType);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`素人API取得状況を読めませんでした: ${error.message}`);
  return data as FanzaAmateurApiCatalogRun | null;
}

export async function startFanzaAmateurApiCatalogRun(runType: FanzaAmateurRunType) {
  if (runType !== "weekly_full") {
    throw new Error("新規取得は全作品の再照合のみ実行できます。日次新作補完は終了しました。");
  }
  let current = await getActiveFanzaAmateurApiCatalogRun();
  if (current && isLegacyRunningRun(current)) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_api_catalog_runs")
      .update({
        status: "needs_attention",
        last_error: "旧50,000件スキャナーの途中状態です。取得済み履歴は保持し、新方式では再開せず、新しい週次全件補完を開始してください。",
        updated_at: now,
        completed_at: now,
      })
      .eq("id", current.id)
      .eq("status", "running")
      .eq("updated_at", current.updated_at)
      .select(RUN_FIELDS)
      .maybeSingle();
    if (error) throw new Error(`旧補完ジョブを保護状態にできませんでした: ${error.message}`);
    if (!data) throw new Error("旧補完ジョブの状態が変わりました。画面を再読み込みしてください。");
    current = await getActiveFanzaAmateurApiCatalogRun();
  }
  if (current) {
    if (current.run_type === runType) return current;
    throw new Error("別の素人作品補完が実行中です。先に現在の補完を完了または一時停止してください。");
  }

  const initialRange: DateRange = { fromDate: "1900-01-01", toDate: "2100-12-31" };
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .insert({
      status: "running",
      run_type: runType,
      source_sort: "date",
      next_offset: 1,
      pending_ranges: [initialRange],
    })
    .select(RUN_FIELDS)
    .single();
  if (error) {
    const racedRun = await getActiveFanzaAmateurApiCatalogRun();
    if (racedRun?.run_type === runType) return racedRun;
    if (racedRun) throw new Error("別の素人作品補完が先に開始されました。現在の実行状況を確認してください。");
    throw new Error(`素人作品補完を開始できませんでした: ${error.message}`);
  }
  return data as FanzaAmateurApiCatalogRun;
}

export function isLegacyRunningRun(run: FanzaAmateurApiCatalogRun) {
  return run.status === "running"
    && !run.current_range
    && (run.pending_ranges?.length ?? 0) === 0
    && run.expected_item_count === 0
    && run.completed_range_count === 0
    && run.range_count === 0;
}

async function persistRun(run: FanzaAmateurApiCatalogRun, updates: Record<string, unknown>) {
  const persistCatalogRun = supabaseAdmin.rpc as unknown as (
    functionName: string,
    args: {
      p_run_id: string;
      p_expected_updated_at: string;
      p_updates: Record<string, unknown>;
    },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await persistCatalogRun(
    "persist_fanza_amateur_api_catalog_run",
    {
      p_run_id: run.id,
      p_expected_updated_at: run.updated_at,
      p_updates: updates,
    },
  );
  if (error) throw new Error(`補完の進捗を保存できませんでした: ${error.message}`);
  const updatedRun = Array.isArray(data) ? data[0] : data;
  if (!updatedRun) throw new Error("補完ジョブの状態が変わりました。画面を再読み込みしてください。");
  return updatedRun as FanzaAmateurApiCatalogRun;
}

function workRowsFor(run: FanzaAmateurApiCatalogRun, range: ActiveDateRange, rawItems: ApiItem[], fetchedAt: string) {
  return rawItems.map((rawItem, index) => {
    const contentId = String(rawItem.content_id).trim();
    return {
      content_id: contentId,
      source_run_id: run.id,
      source_offset: range.offset + index,
      fetched_at: fetchedAt,
      last_seen_at: fetchedAt,
      is_listed: true,
      missing_since: null,
      service_code: asText(rawItem.service_code),
      service_name: asText(rawItem.service_name),
      floor_code: asText(rawItem.floor_code),
      floor_name: asText(rawItem.floor_name),
      category_name: asText(rawItem.category_name),
      product_id: asText(rawItem.product_id),
      title: asText(rawItem.title),
      volume: asText(rawItem.volume),
      review: rawItem.review ?? null,
      api_url: asText(rawItem.URL),
      affiliate_url: asText(rawItem.affiliateURL),
      image_url: rawItem.imageURL ?? null,
      sample_image_url: rawItem.sampleImageURL ?? null,
      sample_movie_url: rawItem.sampleMovieURL ?? null,
      prices: rawItem.prices ?? null,
      api_date: asText(rawItem.date),
      iteminfo: rawItem.iteminfo ?? null,
      campaign: rawItem.campaign ?? null,
      rank: asCount(rawItem.rank),
      raw_item: rawItem,
    };
  });
}

async function finishRun(run: FanzaAmateurApiCatalogRun) {
  const { count, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_items")
    .select("content_id", { count: "exact", head: true })
    .eq("run_id", run.id);
  if (error) throw new Error(`走査済み件数を確認できませんでした: ${error.message}`);
  if ((count ?? 0) !== run.expected_item_count) {
    return persistRun(run, {
      status: "needs_attention",
      last_error: `分割検索の件数(${run.expected_item_count})と保存した作品ID数(${count ?? 0})が一致しません。欠落を防ぐため、掲載終了判定は保留しました。`,
      completed_at: new Date().toISOString(),
    });
  }

  if (run.run_type === "weekly_full") {
    const { error: confirmedMissingError } = await supabaseAdmin
      .from("fanza_amateur_works")
      .update({ is_listed: false })
      .eq("is_listed", true)
      .not("missing_since", "is", null)
      .lt("missing_since", run.started_at)
      .lt("last_seen_at", run.started_at);
    if (confirmedMissingError) throw new Error(`掲載終了を確認できませんでした: ${confirmedMissingError.message}`);

    const { error: candidateError } = await supabaseAdmin
      .from("fanza_amateur_works")
      .update({ missing_since: new Date().toISOString() })
      .eq("is_listed", true)
      .is("missing_since", null)
      .lt("last_seen_at", run.started_at);
    if (candidateError) throw new Error(`未掲載候補を記録できませんでした: ${candidateError.message}`);
  }

  if (run.run_type !== "weekly_full") {
    return persistRun(run, { status: "completed", last_error: null, completed_at: new Date().toISOString() });
  }

  return persistRun(run, {
    rank_next_offset: 1,
    rank_fetched_item_count: 0,
    rank_total_count: null,
    rank_snapshot_at: new Date().toISOString(),
    last_error: null,
  });
}

async function savePopularityRankRows(run: FanzaAmateurApiCatalogRun, capturedAt: string, rankRows: Array<{ rank: number; content_id: string }>) {
  if (rankRows.length === 0) return;
  const { data, error } = await supabaseAdmin.rpc("save_fanza_amateur_rank_snapshot_page", {
    p_run_id: run.id,
    p_captured_at: capturedAt,
    p_items: rankRows,
  });
  if (error) throw new Error(`人気順位を保存できませんでした: ${error.message}`);
  if (Number(data) !== rankRows.length) throw new Error("保存した人気順位の件数が取得件数と一致しませんでした。");
}

async function assertPopularityRankSnapshotCount(run: FanzaAmateurApiCatalogRun, targetCount: number) {
  const { count, error } = await supabaseAdmin
    .from("fanza_amateur_rank_snapshot_items")
    .select("rank", { count: "exact", head: true })
    .eq("run_id", run.id);
  if (error) throw new Error(`保存済み順位を確認できませんでした: ${error.message}`);
  if ((count ?? 0) !== targetCount) throw new Error(`順位保存件数が一致しません（必要${targetCount}件 / 保存${count ?? 0}件）。`);
}

async function commitDailyPriceHistoryBatches(runId: string) {
  const commitPriceHistoryBatch = supabaseAdmin.rpc as unknown as (
    functionName: string,
    args: { p_run_id: string; p_after_content_id: string | null; p_batch_size: number },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  let priceHistoryCursor: string | null = null;
  let priceHistoryBatchCount = 0;
  let priceHistoryDone = false;
  while (!priceHistoryDone) {
    const { data, error: priceHistoryError } = await commitPriceHistoryBatch(
      "commit_fanza_amateur_daily_price_history_batch",
      { p_run_id: runId, p_after_content_id: priceHistoryCursor, p_batch_size: DAILY_PRICE_HISTORY_BATCH_SIZE },
    );
    if (priceHistoryError) {
      throw new Error(`日次価格履歴の分割保存に失敗しました（バッチ${priceHistoryBatchCount + 1}）: ${priceHistoryError.message}`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("日次価格履歴の分割保存から有効な進捗が返りませんでした。");
    }
    const batch = data as { next_cursor?: unknown; done?: unknown };
    if (typeof batch.done !== "boolean" || (batch.next_cursor !== null && typeof batch.next_cursor !== "string")) {
      throw new Error("日次価格履歴の分割保存から不正な進捗が返りました。");
    }
    if (batch.next_cursor === priceHistoryCursor && !batch.done) {
      throw new Error("日次価格履歴の分割保存位置が進まなかったため停止しました。");
    }
    priceHistoryCursor = batch.next_cursor as string | null;
    priceHistoryDone = batch.done;
    priceHistoryBatchCount += 1;
    if (priceHistoryBatchCount > 200) throw new Error("日次価格履歴の分割保存が200バッチを超えたため停止しました。");
  }
}

async function finishPopularityRankRun(run: FanzaAmateurApiCatalogRun, nextOffset: number, fetchedCount: number, expectedTotalCount: number) {
  await assertPopularityRankSnapshotCount(run, Math.min(POPULARITY_RANK_LIMIT, expectedTotalCount));
  await commitDailyPriceHistoryBatches(run.id);
  return persistRun(run, {
    rank_next_offset: nextOffset,
    rank_fetched_item_count: fetchedCount,
    rank_total_count: expectedTotalCount,
    status: "completed",
    last_error: null,
    completed_at: new Date().toISOString(),
  });
}

async function fetchNextPopularityRankPage(run: FanzaAmateurApiCatalogRun) {
  const { response, payload, rawItems } = await fetchFanzaAmateurApiItemListPage({
    offset: run.rank_next_offset,
    hits: PAGE_SIZE,
    sort: "rank",
  });
  const result = payload.result;
  if (!response.ok || String(result?.status ?? "200") !== "200" || !Array.isArray(rawItems)) {
    throw new Error(`人気順取得に失敗しました（${safeFanzaAmateurApiError(response.status, payload)}）`);
  }
  const items = rawItems as ApiItem[];
  const plan = buildFanzaAmateurApiPopularityPagePlan({
    run,
    items,
    totalCount: asCount(result?.total_count),
    rankLimit: POPULARITY_RANK_LIMIT,
    capturedAtFallback: new Date().toISOString(),
  });
  await savePopularityRankRows(run, plan.capturedAt, plan.rankRows);

  if (plan.complete) {
    return finishPopularityRankRun(run, plan.nextOffset, plan.fetchedCount, plan.expectedTotalCount);
  }

  return persistRun(run, {
    rank_next_offset: plan.nextOffset,
    rank_fetched_item_count: plan.fetchedCount,
    rank_total_count: plan.expectedTotalCount,
    rank_snapshot_at: plan.capturedAt,
    last_error: null,
  });
}

async function activateNextCatalogRange(run: FanzaAmateurApiCatalogRun) {
  const pendingRanges = [...(run.pending_ranges ?? [])];
  const currentRange = run.current_range;
  if (currentRange) return { run, activeRange: currentRange, pendingRanges, exhausted: false };
  const nextRange = pendingRanges.shift();
  if (!nextRange) return { run, activeRange: null, pendingRanges, exhausted: true };
  const activeRange = { ...nextRange, offset: 1, expectedCount: null };
  const updatedRun = await persistRun(run, { current_range: activeRange, pending_ranges: pendingRanges, next_offset: 1 });
  return { run: updatedRun, activeRange: updatedRun.current_range, pendingRanges, exhausted: false };
}

async function handleCatalogOffsetLimit(run: FanzaAmateurApiCatalogRun, activeRange: ActiveDateRange) {
  if (activeRange.offset <= API_OFFSET_LIMIT) return null;
  return persistRun(run, {
    status: "needs_attention",
    last_error: `この期間の取得位置がoffset上限${API_OFFSET_LIMIT}を超えました。期間をさらに分割する必要があります。`,
    completed_at: new Date().toISOString(),
  });
}

async function handleCatalogRangeCountLimit(
  run: FanzaAmateurApiCatalogRun,
  activeRange: ActiveDateRange,
  pendingRanges: DateRange[],
  totalCount: number,
) {
  if (activeRange.expectedCount === null && totalCount > API_RANGE_LIMIT) {
    const split = splitFanzaAmateurApiDateRange(activeRange);
    if (!split) {
      return persistRun(run, {
        status: "needs_attention",
        last_error: `${activeRange.fromDate}〜${activeRange.toDate}だけで${totalCount.toLocaleString("ja-JP")}件あり、offset上限${API_OFFSET_LIMIT}以内に収まりません。日付より細かく分けるAPI条件が必要です。掲載終了判定は行っていません。`,
        completed_at: new Date().toISOString(),
      });
    }
    return persistRun(run, {
      current_range: null,
      pending_ranges: [...split, ...pendingRanges],
      next_offset: 1,
      last_error: null,
    });
  }
  if (activeRange.expectedCount !== null && totalCount > API_RANGE_LIMIT) {
    return persistRun(run, {
      status: "needs_attention",
      last_error: `走査中に期間件数が${API_RANGE_LIMIT}を超えました。件数が安定していないため、掲載終了判定は行っていません。`,
      completed_at: new Date().toISOString(),
    });
  }
  return null;
}

async function persistFetchedCatalogPageItems(
  run: FanzaAmateurApiCatalogRun,
  activeRange: ActiveDateRange,
  rawItems: ApiItem[],
  fetchedAt: string,
) {
  if (rawItems.length === 0) return;
  const contentIds = catalogContentIds(rawItems);
  const { data: existingWorks, error: existingWorksError } = await supabaseAdmin
    .from("fanza_amateur_works")
    .select("content_id,raw_item")
    .in("content_id", contentIds);
  if (existingWorksError) throw new Error(`通知対象の既存作品を確認できませんでした: ${existingWorksError.message}`);
  const existingById = new Map((existingWorks ?? []).map((work) => [work.content_id as string, work.raw_item]));
  const { newContentIds, changedPriceContentIds } = catalogItemChangeIds(rawItems, existingById, normalizeFanzaAmateurCatalogItem);
  const historyRows = rawItems.map((rawItem, index) => ({
    run_id: run.id,
    content_id: String(rawItem.content_id).trim(),
    source_offset: activeRange.offset + index,
    raw_item: rawItem,
    fetched_at: fetchedAt,
  }));
  const { error: historyError } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_items")
    .upsert(historyRows, { onConflict: "run_id,content_id" });
  if (historyError) throw new Error(`取得履歴を保存できませんでした: ${historyError.message}`);

  const { error: worksError } = await supabaseAdmin
    .from("fanza_amateur_works")
    .upsert(workRowsFor(run, activeRange, rawItems, fetchedAt), { onConflict: "content_id" });
  if (worksError) throw new Error(`素人作品テーブルへ保存できませんでした: ${worksError.message}`);

  const notificationResults = await Promise.allSettled([
    notifyAmateurPriceAlertsForContentIds(changedPriceContentIds),
    notifyAmateurMakerAlertsForContentIds(newContentIds),
  ]);
  for (const result of notificationResults) {
    if (result.status === "rejected") console.error("[fanza-amateur] push notification processing failed", result.reason);
  }

  const uniqueContentIds = [...new Set(contentIds)];
  const weeklyCutoff = new Date(Date.parse(fetchedAt) - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentSnapshots = await supabaseAdmin
    .from("fanza_amateur_price_weekly_snapshots")
    .select("content_id")
    .in("content_id", uniqueContentIds)
    .gt("observed_at", weeklyCutoff);
  if (recentSnapshots.error) throw new Error(`週次価格履歴の有無を確認できませんでした: ${recentSnapshots.error.message}`);
  const recentIds = new Set((recentSnapshots.data ?? []).map((row) => row.content_id as string));
  const weeklySnapshots = buildFanzaAmateurWeeklyPriceSnapshotRows(rawItems, recentIds, run.id, fetchedAt);
  if (weeklySnapshots.length > 0) {
    const { error: snapshotError } = await supabaseAdmin
      .from("fanza_amateur_price_weekly_snapshots")
      .upsert(weeklySnapshots, { onConflict: "source_run_id,content_id" });
    if (snapshotError) throw new Error(`週次価格履歴を保存できませんでした: ${snapshotError.message}`);
  }
}

async function persistCatalogPageProgress(
  run: FanzaAmateurApiCatalogRun,
  activeRange: ActiveDateRange,
  pendingRanges: DateRange[],
  rawItems: ApiItem[],
  totalCount: number,
) {
  const progress = buildFanzaAmateurApiCatalogPageProgress({
    run,
    activeRange,
    pendingRanges,
    rawItemCount: rawItems.length,
    observedItemKeyPaths: observedCatalogItemKeyPaths(run.observed_item_key_paths ?? [], rawItems),
    totalCount,
  });
  const updatedRun = await persistRun(run, progress.updates);
  if (progress.kind === "recovery") return updatedRun;
  if (!progress.rangeComplete || pendingRanges.length > 0) return updatedRun;
  return finishRun(updatedRun);
}

export async function fetchNextFanzaAmateurApiCatalogPage(run: FanzaAmateurApiCatalogRun) {
  if (run.status !== "running") throw new Error("この補完ジョブは実行中ではありません。");

  try {
    if (run.rank_next_offset > 0) return await fetchNextPopularityRankPage(run);
    const activated = await activateNextCatalogRange(run);
    run = activated.run;
    if (activated.exhausted) return finishRun(run);
    const { activeRange, pendingRanges } = activated;
    if (!activeRange) throw new Error("次の検索期間を設定できませんでした。");
    const offsetLimitRun = await handleCatalogOffsetLimit(run, activeRange);
    if (offsetLimitRun) return offsetLimitRun;

    const { payload, rawItems } = await fetchApiPage(activeRange, activeRange.offset);
    const totalCount = asCount(payload.result?.total_count);
    if (totalCount === null) throw new Error("DMM APIのtotal_countを読み取れませんでした。");

    const rangeLimitRun = await handleCatalogRangeCountLimit(run, activeRange, pendingRanges, totalCount);
    if (rangeLimitRun) return rangeLimitRun;

    const fetchedAt = new Date().toISOString();
    const invalidItemCount = countInvalidCatalogContentIds(rawItems);
    if (invalidItemCount > 0) {
      throw new Error(`DMM APIの返却作品${rawItems.length}件中${invalidItemCount}件にcontent_idがなく、欠落を避けるため保存を停止しました。`);
    }
    await persistFetchedCatalogPageItems(run, activeRange, rawItems, fetchedAt);
    return persistCatalogPageProgress(run, activeRange, pendingRanges, rawItems, totalCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : "DMM APIの取得に失敗しました。";
    await supabaseAdmin
      .from("fanza_amateur_api_catalog_runs")
      .update({ last_error: message, updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("status", "running");
    throw error;
  }
}
