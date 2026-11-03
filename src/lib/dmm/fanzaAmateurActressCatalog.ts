import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildFanzaAmateurAffiliateUrl } from "@/lib/dmm/fanzaAmateurAffiliate";
import { normalizeFanzaAmateurCatalogItem, priceNumber } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import { loadAmateurSummaryPriceHistory } from "@/lib/dmm/fanzaAmateurCatalogPriceReads";
import type { FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurHomeProjection";
import { projectFanzaAmateurActressWorkRow, type FanzaAmateurActressWorkRow } from "@/lib/dmm/fanzaAmateurActressWorkProjection";

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
  const items = rows.flatMap((row) => {
    const item = projectFanzaAmateurActressWorkRow(
      row,
      (rawItem) => normalizeFanzaAmateurCatalogItem(rawItem, buildFanzaAmateurAffiliateUrl),
    );
    return item ? [item] : [];
  });
  const totalCount = Number(rows[0]?.total_count ?? 0);
  const contentIds = items.map(({ item }) => item.content_id);
  const priceWindowEndAt = new Date().toISOString();
  const priceWindowStartAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const historyRows = await loadAmateurSummaryPriceHistory(contentIds, priceWindowStartAt);

  const historyByContentId = new Map<string, Array<{ price: number; changedAt: string; priceKind: "regular" | "sale" | null }>>();
  for (const row of historyRows) {
    const price = priceNumber(row.price);
    if (price == null) continue;
    const history = historyByContentId.get(row.content_id) ?? [];
    history.push({ price, changedAt: row.observed_at, priceKind: null });
    historyByContentId.set(row.content_id, history);
  }
  const cards: FanzaAmateurHomeCard[] = items.map(({ item }) => {
    const history = [...(historyByContentId.get(item.content_id) ?? [])].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    const priceHistory = item.currentPrice == null ? history : [
      ...history,
      { price: item.currentPrice, changedAt: priceWindowEndAt, priceKind: null, isCurrent: true },
    ];
    return {
      item,
      priceHistory,
      priceWindowStartAt,
      priceWindowEndAt,
      lowestObservedPrice: priceHistory.length ? Math.min(...priceHistory.map((point) => point.price)) : null,
    };
  });
  return { cards, totalCount, totalPages: Math.ceil(totalCount / safePageSize), page: safePage };
}
