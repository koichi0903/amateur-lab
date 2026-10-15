import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FANZA_AMATEUR_FLOOR, getFanzaAmateurAffiliateId } from "@/lib/dmm/fanzaAmateurCatalog";

const PAGE_SIZE = 100;
const API_OFFSET_LIMIT = 50_000;
const API_ROOT = "https://api.dmm.com/affiliate/v3/ItemList";

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
  status: "running" | "completed" | "limit_reached";
  source_sort: "date";
  total_count: number | null;
  next_offset: number;
  fetched_item_count: number;
  observed_item_key_paths: string[];
  last_error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
};

function apiAffiliateId() {
  return getFanzaAmateurAffiliateId();
}

function asCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function asJson(value: unknown) {
  return value !== undefined ? value : null;
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

function safeApiError(response: Response, payload: ItemListResponse) {
  const result = payload.result;
  const status = String(result?.status ?? response.status);
  return `DMM APIの取得に失敗しました（HTTP ${response.status} / API ${status}）。`;
}

export async function getActiveFanzaAmateurApiCatalogRun() {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .select("id,status,source_sort,total_count,next_offset,fetched_item_count,observed_item_key_paths,last_error,started_at,updated_at,completed_at")
    .eq("status", "running")
    .maybeSingle();
  if (error) throw new Error(`素人API取得状況を読めませんでした: ${error.message}`);
  return data as FanzaAmateurApiCatalogRun | null;
}

export async function getLatestFanzaAmateurApiCatalogRun() {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .select("id,status,source_sort,total_count,next_offset,fetched_item_count,observed_item_key_paths,last_error,started_at,updated_at,completed_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`素人API取得状況を読めませんでした: ${error.message}`);
  return data as FanzaAmateurApiCatalogRun | null;
}

export async function startFanzaAmateurApiCatalogRun() {
  const current = await getActiveFanzaAmateurApiCatalogRun();
  if (current) return current;

  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .insert({ status: "running", source_sort: "date", next_offset: 1 })
    .select("id,status,source_sort,total_count,next_offset,fetched_item_count,observed_item_key_paths,last_error,started_at,updated_at,completed_at")
    .single();
  if (error) {
    const racedRun = await getActiveFanzaAmateurApiCatalogRun();
    if (racedRun) return racedRun;
    throw new Error(`全作品取得を開始できませんでした: ${error.message}`);
  }
  return data as FanzaAmateurApiCatalogRun;
}

export async function fetchNextFanzaAmateurApiCatalogPage(run: FanzaAmateurApiCatalogRun) {
  const apiId = process.env.DMM_API_ID?.trim();
  if (!apiId) throw new Error("DMM API IDが設定されていません。");
  if (run.status !== "running") throw new Error("この取得ジョブは実行中ではありません。");
  if (run.next_offset > API_OFFSET_LIMIT) {
    return completeRun(run, run.total_count);
  }

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: apiAffiliateId(),
    site: "FANZA",
    service: "digital",
    floor: FANZA_AMATEUR_FLOOR,
    hits: String(PAGE_SIZE),
    offset: String(run.next_offset),
    sort: run.source_sort,
    output: "json",
  });

  try {
    const response = await fetch(`${API_ROOT}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => ({})) as ItemListResponse;
    const result = payload.result;
    const rawItems = result?.items;
    if (!response.ok || String(result?.status ?? "200") !== "200" || !Array.isArray(rawItems)) {
      throw new Error(safeApiError(response, payload));
    }

    const fetchedAt = new Date().toISOString();
    const totalCount = asCount(result?.total_count) ?? run.total_count;
    const apiItems = rawItems as ApiItem[];
    const invalidItemCount = apiItems.filter((rawItem) => typeof rawItem?.content_id !== "string" || !rawItem.content_id.trim()).length;
    if (invalidItemCount > 0) {
      throw new Error(`DMM APIの返却作品${apiItems.length}件中${invalidItemCount}件にcontent_idがなく、欠落を避けるため保存を停止しました。`);
    }
    const rows = apiItems.map((rawItem, index) => {
      const contentId = String(rawItem.content_id).trim();
      return {
        run_id: run.id,
        content_id: contentId,
        source_offset: run.next_offset + index,
        raw_item: rawItem,
        fetched_at: fetchedAt,
      };
    });
    const workRows = apiItems.map((rawItem, index) => {
      const contentId = String(rawItem.content_id).trim();
      return {
        content_id: contentId,
        source_run_id: run.id,
        source_offset: run.next_offset + index,
        fetched_at: fetchedAt,
        service_code: asText(rawItem.service_code),
        service_name: asText(rawItem.service_name),
        floor_code: asText(rawItem.floor_code),
        floor_name: asText(rawItem.floor_name),
        category_name: asText(rawItem.category_name),
        product_id: asText(rawItem.product_id),
        title: asText(rawItem.title),
        volume: asText(rawItem.volume),
        review: asJson(rawItem.review),
        api_url: asText(rawItem.URL),
        affiliate_url: asText(rawItem.affiliateURL),
        image_url: asJson(rawItem.imageURL),
        sample_image_url: asJson(rawItem.sampleImageURL),
        sample_movie_url: asJson(rawItem.sampleMovieURL),
        prices: asJson(rawItem.prices),
        api_date: asText(rawItem.date),
        iteminfo: asJson(rawItem.iteminfo),
        campaign: asJson(rawItem.campaign),
        rank: asCount(rawItem.rank),
        raw_item: rawItem,
      };
    });
    const observedKeyPaths = new Set(run.observed_item_key_paths ?? []);
    for (const rawItem of rawItems) {
      for (const path of collectItemKeyPaths(rawItem as ApiItem)) observedKeyPaths.add(path);
    }

    if (rows.length > 0) {
      const saved = await supabaseAdmin
        .from("fanza_amateur_api_catalog_items")
        .upsert(rows, { onConflict: "run_id,content_id" });
      if (saved.error) throw new Error(`作品API情報を保存できませんでした: ${saved.error.message}`);

      const savedWorks = await supabaseAdmin
        .from("fanza_amateur_works")
        .upsert(workRows, { onConflict: "content_id" });
      if (savedWorks.error) throw new Error(`素人作品テーブルへ保存できませんでした: ${savedWorks.error.message}`);
    }

    const nextOffset = run.next_offset + rawItems.length;
    const hasMore = rawItems.length === PAGE_SIZE
      && nextOffset <= API_OFFSET_LIMIT
      && (totalCount === null || nextOffset <= totalCount);
    const reachedApiLimit = !hasMore
      && nextOffset > API_OFFSET_LIMIT
      && rawItems.length === PAGE_SIZE
      && (totalCount === null || totalCount >= API_OFFSET_LIMIT);
    const update = {
      total_count: totalCount,
      next_offset: nextOffset,
      fetched_item_count: run.fetched_item_count + rawItems.length,
      observed_item_key_paths: [...observedKeyPaths].sort(),
      status: hasMore ? "running" : reachedApiLimit ? "limit_reached" : "completed",
      last_error: null,
      updated_at: fetchedAt,
      completed_at: hasMore ? null : fetchedAt,
    };
    const savedRun = await supabaseAdmin
      .from("fanza_amateur_api_catalog_runs")
      .update(update)
      .eq("id", run.id)
      .eq("status", "running")
      .eq("next_offset", run.next_offset)
      .select("id,status,source_sort,total_count,next_offset,fetched_item_count,observed_item_key_paths,last_error,started_at,updated_at,completed_at")
      .maybeSingle();
    if (savedRun.error) throw new Error(`全作品取得の進捗を保存できませんでした: ${savedRun.error.message}`);
    if (!savedRun.data) throw new Error("全作品取得の進捗が他の処理で更新されました。状況を再読み込みしてください。");
    return savedRun.data as FanzaAmateurApiCatalogRun;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DMM APIの取得に失敗しました。";
    await supabaseAdmin
      .from("fanza_amateur_api_catalog_runs")
      .update({ last_error: message, updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("status", "running")
      .eq("next_offset", run.next_offset);
    throw error;
  }
}

async function completeRun(run: FanzaAmateurApiCatalogRun, totalCount: number | null) {
  const now = new Date().toISOString();
  const status = run.next_offset > API_OFFSET_LIMIT ? "limit_reached" : "completed";
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_runs")
    .update({ status, total_count: totalCount, updated_at: now, completed_at: now })
    .eq("id", run.id)
    .eq("status", "running")
    .select("id,status,source_sort,total_count,next_offset,fetched_item_count,observed_item_key_paths,last_error,started_at,updated_at,completed_at")
    .single();
  if (error) throw new Error(`全作品取得を完了できませんでした: ${error.message}`);
  return data as FanzaAmateurApiCatalogRun;
}
