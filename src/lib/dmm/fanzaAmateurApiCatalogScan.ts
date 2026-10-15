import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FANZA_AMATEUR_FLOOR, getFanzaAmateurAffiliateId } from "@/lib/dmm/fanzaAmateurCatalog";
import {
  extractFanzaAmateurPriceHistoryRows,
  selectChangedFanzaAmateurPriceHistoryRowsByWork,
} from "@/lib/dmm/fanzaAmateurPriceHistory";

const PAGE_SIZE = 100;
const API_OFFSET_LIMIT = 5_000;
const API_RANGE_LIMIT = 5_000;
const API_ROOT = "https://api.dmm.com/affiliate/v3/ItemList";
const RUN_FIELDS = "id,status,run_type,source_sort,total_count,next_offset,fetched_item_count,observed_item_key_paths,last_error,started_at,updated_at,completed_at,pending_ranges,current_range,expected_item_count,completed_range_count,range_count";

export type FanzaAmateurRunType = "daily_incremental" | "weekly_full";
type DateRange = { fromDate: string; toDate: string };
type ActiveDateRange = DateRange & { offset: number; expectedCount: number | null };
type ApiItem = Record<string, unknown> & { content_id?: unknown };
type ItemListResponse = {
  result?: {
    status?: number | string;
    total_count?: number | string;
    result_count?: number | string;
    items?: unknown;
  };
};

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
};

function asCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function collectItemKeyPaths(value: unknown, prefix = "", paths = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    const arrayPath = `${prefix}[]`;
    paths.add(arrayPath);
    for (const entry of value) collectItemKeyPaths(entry, arrayPath, paths);
    return paths;
  }
  if (value && typeof value === "object") {
    if (prefix) paths.add(prefix);
    for (const [key, entry] of Object.entries(value)) {
      collectItemKeyPaths(entry, prefix ? `${prefix}.${key}` : key, paths);
    }
    return paths;
  }
  if (prefix) paths.add(prefix);
  return paths;
}

function jstDateOffset(days: number) {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  jst.setUTCDate(jst.getUTCDate() + days);
  return jst.toISOString().slice(0, 10);
}

function rangeParams(range: DateRange) {
  return {
    gte_date: `${range.fromDate}T00:00:00`,
    lte_date: `${range.toDate}T23:59:59`,
  };
}

function splitDateRange(range: DateRange): [DateRange, DateRange] | null {
  const start = Date.parse(`${range.fromDate}T00:00:00Z`);
  const end = Date.parse(`${range.toDate}T00:00:00Z`);
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 2) return null;
  const leftDays = Math.floor(days / 2);
  const middle = new Date(start + (leftDays - 1) * 86_400_000).toISOString().slice(0, 10);
  const rightStart = new Date(start + leftDays * 86_400_000).toISOString().slice(0, 10);
  return [
    { fromDate: range.fromDate, toDate: middle },
    { fromDate: rightStart, toDate: range.toDate },
  ];
}

function safeApiError(response: Response, payload: ItemListResponse) {
  return `DMM APIの取得に失敗しました（HTTP ${response.status} / API ${String(payload.result?.status ?? response.status)}）。`;
}

async function fetchApiPage(range: DateRange, offset: number) {
  const apiId = process.env.DMM_API_ID?.trim();
  if (!apiId) throw new Error("DMM API IDが設定されていません。");
  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: getFanzaAmateurAffiliateId(),
    site: "FANZA",
    service: "digital",
    floor: FANZA_AMATEUR_FLOOR,
    hits: String(PAGE_SIZE),
    offset: String(offset),
    sort: "date",
    output: "json",
    ...rangeParams(range),
  });
  const response = await fetch(`${API_ROOT}?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as ItemListResponse;
  const rawItems = payload.result?.items;
  if (!response.ok || String(payload.result?.status ?? "200") !== "200" || !Array.isArray(rawItems)) {
    throw new Error(safeApiError(response, payload));
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
  let current = await getActiveFanzaAmateurApiCatalogRun();
  if (current && isLegacyRunningRun(current)) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_api_catalog_runs")
      .update({
        status: "needs_attention",
        last_error: "旧50,000件スキャナーの途中状態です。取得済み履歴は保持し、新方式では再開せず、新しい日次/週次補完を開始してください。",
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

  const initialRange: DateRange = runType === "weekly_full"
    ? { fromDate: "1900-01-01", toDate: "2100-12-31" }
    : { fromDate: jstDateOffset(-7), toDate: jstDateOffset(7) };
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
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("status", "running")
    .eq("updated_at", run.updated_at)
    .select(RUN_FIELDS)
    .maybeSingle();
  if (error) throw new Error(`補完の進捗を保存できませんでした: ${error.message}`);
  if (!data) throw new Error("補完ジョブの状態が変わりました。画面を再読み込みしてください。");
  return data as FanzaAmateurApiCatalogRun;
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
    .from("fanza_amateur_works")
    .select("content_id", { count: "exact", head: true })
    .eq("source_run_id", run.id);
  if (error) throw new Error(`作品表への保存件数を確認できませんでした: ${error.message}`);
  if ((count ?? 0) !== run.expected_item_count) {
    return persistRun(run, {
      status: "needs_attention",
      last_error: `分割検索の件数(${run.expected_item_count})と素人作品表に保存した件数(${count ?? 0})が一致しません。欠落を防ぐため、掲載終了判定は保留しました。`,
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

  return persistRun(run, { status: "completed", last_error: null, completed_at: new Date().toISOString() });
}

export async function fetchNextFanzaAmateurApiCatalogPage(run: FanzaAmateurApiCatalogRun) {
  if (run.status !== "running") throw new Error("この補完ジョブは実行中ではありません。");

  try {
    let activeRange = run.current_range;
    const pendingRanges = [...(run.pending_ranges ?? [])];
    if (!activeRange) {
      const nextRange = pendingRanges.shift();
      if (!nextRange) return finishRun(run);
      activeRange = { ...nextRange, offset: 1, expectedCount: null };
      run = await persistRun(run, { current_range: activeRange, pending_ranges: pendingRanges, next_offset: 1 });
      activeRange = run.current_range;
    }
    if (!activeRange) throw new Error("次の検索期間を設定できませんでした。");
    if (activeRange.offset > API_OFFSET_LIMIT) {
      return persistRun(run, {
        status: "needs_attention",
        last_error: `この期間の取得位置がoffset上限${API_OFFSET_LIMIT}を超えました。期間をさらに分割する必要があります。`,
        completed_at: new Date().toISOString(),
      });
    }

    const { payload, rawItems } = await fetchApiPage(activeRange, activeRange.offset);
    const totalCount = asCount(payload.result?.total_count);
    if (totalCount === null) throw new Error("DMM APIのtotal_countを読み取れませんでした。");

    if (activeRange.expectedCount === null && totalCount > API_RANGE_LIMIT) {
      const split = splitDateRange(activeRange);
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

    const fetchedAt = new Date().toISOString();
    const invalidItemCount = rawItems.filter((item) => typeof item?.content_id !== "string" || !item.content_id.trim()).length;
    if (invalidItemCount > 0) {
      throw new Error(`DMM APIの返却作品${rawItems.length}件中${invalidItemCount}件にcontent_idがなく、欠落を避けるため保存を停止しました。`);
    }

    if (rawItems.length > 0) {
      const { error: worksError } = await supabaseAdmin
        .from("fanza_amateur_works")
        .upsert(workRowsFor(run, activeRange, rawItems, fetchedAt), { onConflict: "content_id" });
      if (worksError) throw new Error(`素人作品テーブルへ保存できませんでした: ${worksError.message}`);

      const priceRowsByWork = rawItems.flatMap((item) => extractFanzaAmateurPriceHistoryRows(
        String(item.content_id).trim(),
        run.id,
        item,
        fetchedAt,
      ));
      const requiredPriceKeys = new Set(priceRowsByWork.map((row) => `${row.content_id}\u0000${row.price_type}`));
      const previousByWork = new Map<string, Map<string, { price: string | null; list_price: string | null }>>();
      const seenPriceKeys = new Set<string>();
      for (let historyOffset = 0; seenPriceKeys.size < requiredPriceKeys.size; historyOffset += 500) {
        const history = await supabaseAdmin
          .from("fanza_amateur_price_history")
          .select("content_id,price_type,price,list_price")
          .in("content_id", [...new Set(rawItems.map((item) => String(item.content_id).trim()))])
          .order("observed_at", { ascending: false })
          .range(historyOffset, historyOffset + 499);
        if (history.error) throw new Error(`価格履歴比較用の既存履歴を読めませんでした: ${history.error.message}`);
        const historyRows = history.data ?? [];
        for (const row of historyRows) {
          const key = `${row.content_id}\u0000${row.price_type}`;
          if (!requiredPriceKeys.has(key) || seenPriceKeys.has(key)) continue;
          seenPriceKeys.add(key);
          const byType = previousByWork.get(row.content_id) ?? new Map();
          byType.set(row.price_type, { price: row.price, list_price: row.list_price });
          previousByWork.set(row.content_id, byType);
        }
        if (historyRows.length < 500) break;
      }
      const { changed } = selectChangedFanzaAmateurPriceHistoryRowsByWork(priceRowsByWork, previousByWork);
      for (let index = 0; index < changed.length; index += 500) {
        const { error: priceError } = await supabaseAdmin
          .from("fanza_amateur_price_history")
          .upsert(changed.slice(index, index + 500), { onConflict: "source_run_id,content_id,price_type" });
        if (priceError) throw new Error(`価格変更履歴を保存できませんでした: ${priceError.message}`);
      }
    }

    const keyPaths = new Set(run.observed_item_key_paths ?? []);
    for (const item of rawItems) for (const path of collectItemKeyPaths(item)) keyPaths.add(path);
    const expectedCount = activeRange.expectedCount ?? totalCount;
    const nextOffset = activeRange.offset + rawItems.length;
    const rangeComplete = rawItems.length === 0 || nextOffset > expectedCount;
    const nextActiveRange = rangeComplete ? null : { ...activeRange, expectedCount, offset: nextOffset };
    const updatedRun = await persistRun(run, {
      total_count: totalCount,
      next_offset: nextOffset,
      fetched_item_count: run.fetched_item_count + rawItems.length,
      observed_item_key_paths: [...keyPaths].sort(),
      current_range: nextActiveRange,
      pending_ranges: pendingRanges,
      expected_item_count: run.expected_item_count + (activeRange.expectedCount === null ? expectedCount : 0),
      range_count: run.range_count + (activeRange.expectedCount === null ? 1 : 0),
      completed_range_count: run.completed_range_count + (rangeComplete ? 1 : 0),
      last_error: null,
    });
    if (!rangeComplete) return updatedRun;
    if (pendingRanges.length > 0) return updatedRun;
    return finishRun(updatedRun);
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
