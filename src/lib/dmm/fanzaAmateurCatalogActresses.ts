import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildFanzaAmateurAffiliateUrl } from "@/lib/dmm/fanzaAmateurAffiliate";
import { projectFanzaAmateurActressWorkRow, type FanzaAmateurActressWorkRow } from "@/lib/dmm/fanzaAmateurActressWorkProjection";
import { normalizeFanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import { indexFanzaAmateurPriceHistory, projectFanzaAmateurPriceChart } from "@/lib/dmm/fanzaAmateurPriceChartProjection";
import type { FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurHomeProjection";

export type FanzaAmateurActressSort = "count-desc" | "count-asc" | "birthday-asc" | "birthday-desc" | "cup-asc" | "cup-desc" | "height-asc" | "height-desc" | "bust-asc" | "bust-desc" | "waist-asc" | "waist-desc" | "hip-asc" | "hip-desc";

export type FanzaAmateurActressSummary = {
  name: string;
  work_count: number;
  image_url: string | null;
  profile_image_url: string | null;
  ruby: string | null;
  birthday: string | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  cup: string | null;
  total_count: number;
};

const FANZA_AMATEUR_ACTRESS_ALIASES: Record<string, string> = {
  "静河": "月瀬りりあ",
};

export function getCanonicalFanzaAmateurActressName(name: string) {
  return FANZA_AMATEUR_ACTRESS_ALIASES[name] ?? name;
}

const getCachedFanzaAmateurActressIndex = unstable_cache(
  async (query: string | null, sort: FanzaAmateurActressSort, offset: number) => {
    const { data, error } = await supabaseAdmin.rpc("get_fanza_amateur_actress_index", {
      p_query: query,
      p_sort: sort,
      p_offset: offset,
      p_limit: 24,
    });
    if (error) throw new Error(`素人出演女優を読み込めませんでした: ${error.message}`);
    return (data ?? []) as FanzaAmateurActressSummary[];
  },
  ["fanza-amateur-actress-index-v2-aliases"],
  { revalidate: 3_600, tags: ["fanza-amateur-actress"] },
);

export async function getFanzaAmateurActressIndex({ query, sort, page }: { query?: string; sort: FanzaAmateurActressSort; page: number }) {
  const safePage = Math.max(1, Math.trunc(page));
  const safeQuery = query?.trim().slice(0, 100) || null;
  const rows = await getCachedFanzaAmateurActressIndex(safeQuery, sort, (safePage - 1) * 24);
  const totalCount = Number(rows[0]?.total_count ?? 0);
  return {
    items: rows,
    page: safePage,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / 24)),
  };
}

export async function getFanzaAmateurActressWorks({ name, page = 1, pageSize = 60, sort = "newest" }: {
  name: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "review";
}) {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(300, Math.max(1, Math.trunc(pageSize)));
  const { data, error } = await supabaseAdmin.rpc("get_fanza_amateur_actress_works", {
    p_name: name,
    p_offset: (safePage - 1) * safePageSize,
    p_limit: safePageSize,
    p_sort: sort,
  });
  if (error) throw new Error(`素人出演作品を読み込めませんでした: ${error.message}`);

  const rows = (data ?? []) as FanzaAmateurActressWorkRow[];
  const projectedRows = rows.map((row) => projectFanzaAmateurActressWorkRow(
    row,
    (rawItem) => normalizeFanzaAmateurCatalogItem(rawItem, buildFanzaAmateurAffiliateUrl),
  ));
  const items = projectedRows.filter((row): row is NonNullable<typeof row> => row !== null);
  const totalCount = Number(rows[0]?.total_count ?? 0);
  const contentIds = items.map(({ item }) => item.content_id);
  const priceWindowEndAt = new Date().toISOString();
  const priceWindowStartAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const historyResult = contentIds.length
    ? await supabaseAdmin.from("fanza_amateur_price_history")
      .select("content_id,observed_at,price")
      .eq("price_type", "summary")
      .in("content_id", contentIds)
      .gte("observed_at", priceWindowStartAt)
      .order("observed_at", { ascending: false })
      .limit(1_000)
    : { data: [], error: null };
  if (historyResult.error) throw new Error(`素人出演作品の価格履歴を読み込めませんでした: ${historyResult.error.message}`);

  const historyByContentId = indexFanzaAmateurPriceHistory(historyResult.data ?? []);
  const cards: FanzaAmateurHomeCard[] = items.map(({ item }) =>
    projectFanzaAmateurPriceChart(item, historyByContentId, priceWindowStartAt, priceWindowEndAt));
  return { cards, totalCount, totalPages: Math.ceil(totalCount / safePageSize), page: safePage };
}
