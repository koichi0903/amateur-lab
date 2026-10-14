import "server-only";
import type { DmmItem } from "@/types/dmm";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const FANZA_AMATEUR_FLOOR = "videoc";
export const FANZA_AMATEUR_PAGE_SIZE = 24;
export type FanzaAmateurSort = "rank" | "date" | "review" | "price" | "-price";

export type FanzaAmateurCatalogItem = DmmItem & {
  affiliateURL: string;
  imageUrl: string | null;
  currentPrice: number | null;
  reviewAverage: number | null;
};

type DmmItemListResponse = {
  result?: {
    status?: number | string;
    result_count?: number | string;
    total_count?: number | string;
    items?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function priceNumber(value: unknown): number | null {
  const digits = asText(value).replace(/[^0-9]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function amateurAffiliateId() {
  return getAmateurAffiliateId();
}

function getAmateurAffiliateId() {
  const configured = process.env.DMM_AMATEUR_AFFILIATE_ID?.trim();
  if (configured?.endsWith("-026")) return configured;

  const defaultId = process.env.DMM_AFFILIATE_ID?.trim();
  const derived = defaultId?.replace(/-\d{3}$/, "-026");
  if (derived?.endsWith("-026")) return derived;

  throw new Error("素人作品用のDMMアフィリエイトID 026を確認できません。");
}

function buildAffiliateUrl(canonicalUrl: string) {
  const target = new URL(canonicalUrl);
  if (target.hostname !== "video.dmm.co.jp" || !target.pathname.startsWith("/amateur/content/")) {
    throw new Error("DMM APIが返した素人作品URLが想定外です。");
  }

  const affiliate = new URL("https://al.fanza.co.jp/");
  affiliate.searchParams.set("lurl", target.href);
  affiliate.searchParams.set("af_id", amateurAffiliateId());
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
  const iteminfo = isRecord(value.iteminfo) ? value.iteminfo : {};
  const originalPrice = priceNumber(prices?.price);
  const listPrice = priceNumber(prices?.list_price);
  const affiliateURL = buildAffiliateUrl(canonicalUrl);
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
      actress: Array.isArray(iteminfo.actress) ? iteminfo.actress as NonNullable<DmmItem["iteminfo"]>["actress"] : [],
      genre: Array.isArray(iteminfo.genre) ? iteminfo.genre as NonNullable<DmmItem["iteminfo"]>["genre"] : [],
      maker: Array.isArray(iteminfo.maker) ? iteminfo.maker as NonNullable<DmmItem["iteminfo"]>["maker"] : [],
      series: Array.isArray(iteminfo.series) ? iteminfo.series as NonNullable<DmmItem["iteminfo"]>["series"] : [],
    },
    imageUrl: asText(image?.large) || asText(image?.list) || asText(image?.small) || null,
    currentPrice: originalPrice ?? listPrice,
    reviewAverage: Number.isFinite(Number(review?.average)) ? Number(review?.average) : null,
  };
}

async function fetchAndSaveFanzaAmateurCatalogPage({
  page,
  sort,
}: {
  page: number;
  sort: FanzaAmateurSort;
}) {
  const apiId = process.env.DMM_API_ID?.trim();
  if (!apiId) throw new Error("DMM APIの設定がありません。");

  const apiAffiliateId = getAmateurAffiliateId();
  const offset = (page - 1) * FANZA_AMATEUR_PAGE_SIZE + 1;
  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: apiAffiliateId,
    site: "FANZA",
    service: "digital",
    floor: FANZA_AMATEUR_FLOOR,
    hits: String(FANZA_AMATEUR_PAGE_SIZE),
    offset: String(offset),
    sort,
    output: "json",
  });
  const response = await fetch(`https://api.dmm.com/affiliate/v3/ItemList?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`DMM APIがHTTP ${response.status}を返しました。`);

  const payload = await response.json() as DmmItemListResponse;
  const result = payload.result;
  const rawItems = result?.items;
  if (String(result?.status ?? "200") !== "200" || !Array.isArray(rawItems)) {
    throw new Error("DMM APIの素人作品データを読み取れませんでした。");
  }

  const items = rawItems.map(normalizeItem).filter((item): item is FanzaAmateurCatalogItem => Boolean(item));
  const totalCount = asCount(result?.total_count) ?? items.length;
  const fetchedAt = new Date().toISOString();
  const saved = await supabaseAdmin.from("fanza_amateur_catalog_pages").upsert({
    sort_key: sort,
    page_number: page,
    page_size: FANZA_AMATEUR_PAGE_SIZE,
    total_count: totalCount,
    items: rawItems,
    fetched_at: fetchedAt,
  }, { onConflict: "sort_key,page_number" });
  if (saved.error) {
    throw new Error(`DMM APIの結果をSupabaseに保存できませんでした: ${saved.error.message}`);
  }

  return {
    items,
    page,
    pageSize: FANZA_AMATEUR_PAGE_SIZE,
    totalCount,
    totalPages: Math.max(1, Math.ceil(Math.min(totalCount, 50_000) / FANZA_AMATEUR_PAGE_SIZE)),
    fetchedAt,
  };
}

export async function getFanzaAmateurCatalogPage({
  page,
  sort,
}: {
  page: number;
  sort: FanzaAmateurSort;
}) {
  const safePage = Math.max(1, Math.min(2_084, Math.trunc(page)));
  const cached = await supabaseAdmin
    .from("fanza_amateur_catalog_pages")
    .select("items,total_count,fetched_at")
    .eq("sort_key", sort)
    .eq("page_number", safePage)
    .maybeSingle();

  if (cached.error) {
    throw new Error(`Supabaseの素人作品データを読めませんでした: ${cached.error.message}`);
  }

  const cachedRow = cached.data as { items?: unknown; total_count?: unknown; fetched_at?: unknown } | null;
  const cachedItems = Array.isArray(cachedRow?.items)
    ? cachedRow.items.map(normalizeItem).filter((item): item is FanzaAmateurCatalogItem => Boolean(item))
    : [];
  const cachedTotal = asCount(cachedRow?.total_count);
  const cachedAt = typeof cachedRow?.fetched_at === "string" ? cachedRow.fetched_at : null;
  const hasCachedPage = cachedRow !== null && Array.isArray(cachedRow.items) && cachedTotal !== null && cachedAt !== null;
  const toCatalogPage = () => ({
    items: cachedItems,
    page: safePage,
    pageSize: FANZA_AMATEUR_PAGE_SIZE,
    totalCount: cachedTotal ?? 0,
    totalPages: Math.max(1, Math.ceil(Math.min(cachedTotal ?? 0, 50_000) / FANZA_AMATEUR_PAGE_SIZE)),
    fetchedAt: cachedAt,
  });

  if (hasCachedPage) {
    return toCatalogPage();
  }

  return fetchAndSaveFanzaAmateurCatalogPage({ page: safePage, sort });
}
