import "server-only";

import type { DmmItem } from "@/types/dmm";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const FANZA_AMATEUR_FLOOR = "videoc";
export const FANZA_AMATEUR_PAGE_SIZE = 24;
export type FanzaAmateurSort = "date" | "review" | "price" | "-price";

export type FanzaAmateurCatalogItem = DmmItem & {
  affiliateURL: string;
  imageUrl: string | null;
  currentPrice: number | null;
  reviewAverage: number | null;
};

type CatalogPageRow = {
  raw_item: unknown;
  fetched_at: string;
  total_count: number | string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function priceNumber(value: unknown): number | null {
  const digits = asText(value).match(/[0-9]+/)?.[0];
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getFanzaAmateurAffiliateId() {
  const configured = process.env.DMM_AMATEUR_AFFILIATE_ID?.trim();
  if (configured?.endsWith("-991")) return configured;

  const defaultId = process.env.DMM_AFFILIATE_ID?.trim();
  const derived = defaultId?.replace(/-\d{3}$/, "-991");
  if (derived?.endsWith("-991")) return derived;

  throw new Error("素人作品用のDMMアフィリエイトID 991を確認できません。");
}

function buildAffiliateUrl(canonicalUrl: string) {
  const target = new URL(canonicalUrl);
  if (target.hostname !== "video.dmm.co.jp" || !target.pathname.startsWith("/amateur/content/")) {
    throw new Error("保存された素人作品URLが想定外です。");
  }

  const affiliate = new URL("https://al.fanza.co.jp/");
  affiliate.searchParams.set("lurl", target.href);
  affiliate.searchParams.set("af_id", getFanzaAmateurAffiliateId());
  return affiliate.href;
}

function normalizeItem(value: unknown): FanzaAmateurCatalogItem | null {
  if (!isRecord(value)) return null;
  const contentId = asText(value.content_id);
  const title = asText(value.title);
  const canonicalUrl = asText(value.URL);
  if (!contentId || !title || !canonicalUrl) return null;

  const image = isRecord(value.imageURL) ? value.imageURL : null;
  const sampleMovie = isRecord(value.sampleMovieURL) ? value.sampleMovieURL : null;
  const prices = isRecord(value.prices) ? value.prices : null;
  const review = isRecord(value.review) ? value.review : null;
  const rawItemInfo = isRecord(value.iteminfo) ? value.iteminfo : {};
  const sampleMovieURL = sampleMovie
    ? Object.fromEntries(
        ["size_476_306", "size_560_360", "size_644_414", "size_720_480"].flatMap((key) => {
          const rawUrl = asText(sampleMovie[key]);
          if (!rawUrl) return [];
          try {
            const url = new URL(rawUrl);
            if (url.protocol !== "https:" || url.hostname !== "www.dmm.co.jp" || !url.pathname.startsWith("/litevideo/")) return [];
            return [[key, url.href]];
          } catch {
            return [];
          }
        }),
      ) as DmmItem["sampleMovieURL"]
    : undefined;
  const affiliateURL = asText(value.affiliateURL) || buildAffiliateUrl(canonicalUrl);

  return {
    ...(value as unknown as DmmItem),
    content_id: contentId,
    title,
    URL: canonicalUrl,
    affiliateURL,
    sampleMovieURL,
    date: asText(value.date),
    prices: {
      price: asText(prices?.price),
      list_price: asText(prices?.list_price),
    },
    iteminfo: {
      actress: Array.isArray(rawItemInfo.actress) ? rawItemInfo.actress as NonNullable<DmmItem["iteminfo"]>["actress"] : [],
      genre: Array.isArray(rawItemInfo.genre) ? rawItemInfo.genre as NonNullable<DmmItem["iteminfo"]>["genre"] : [],
      maker: Array.isArray(rawItemInfo.maker) ? rawItemInfo.maker as NonNullable<DmmItem["iteminfo"]>["maker"] : [],
      series: Array.isArray(rawItemInfo.series) ? rawItemInfo.series as NonNullable<DmmItem["iteminfo"]>["series"] : [],
    },
    imageUrl: asText(image?.large) || asText(image?.list) || asText(image?.small) || null,
    currentPrice: priceNumber(prices?.price) ?? priceNumber(prices?.list_price),
    reviewAverage: Number.isFinite(Number(review?.average)) ? Number(review?.average) : null,
  };
}

export async function getFanzaAmateurCatalogPage({ page, sort }: { page: number; sort: FanzaAmateurSort }) {
  const safePage = Math.max(1, Math.trunc(page));
  const { data, error } = await supabaseAdmin.rpc("get_fanza_amateur_works_page", {
    p_page: safePage,
    p_sort: sort,
  });
  if (error) throw new Error(`素人作品一覧を読めませんでした: ${error.message}`);

  const rows = (data ?? []) as CatalogPageRow[];
  const items = rows.map((row) => normalizeItem(row.raw_item)).filter((item): item is FanzaAmateurCatalogItem => item !== null);
  const totalCount = Number(rows[0]?.total_count ?? 0);

  return {
    items,
    page: safePage,
    totalCount,
    totalPages: Math.ceil(totalCount / FANZA_AMATEUR_PAGE_SIZE),
    fetchedAt: rows.reduce<string | null>((latest, row) => !latest || row.fetched_at > latest ? row.fetched_at : latest, null),
  };
}
