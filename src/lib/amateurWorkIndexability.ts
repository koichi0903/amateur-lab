export type AmateurWorkIndexabilityInput = {
  contentId: string;
  isListed: boolean;
  missingSince: string | null;
  imageUrl: string | null;
  affiliateUrl: string | null;
  price: number | null;
};

export const AMATEUR_WORK_SITEMAP_PAGE_SIZE = 1_000;

export function getAmateurWorkPrice(prices: unknown): number | null {
  if (typeof prices !== "object" || prices === null || Array.isArray(prices)) return null;
  const record = prices as Record<string, unknown>;
  for (const value of [record.price, record.list_price]) {
    const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
    const digits = raw.match(/[0-9][0-9,]*/)?.[0]?.replaceAll(",", "");
    const price = digits ? Number(digits) : Number.NaN;
    if (Number.isSafeInteger(price) && price >= 1) return price;
  }
  return null;
}

export function isAmateurWorkIndexable(work: AmateurWorkIndexabilityInput): boolean {
  return Boolean(
    work.contentId.trim()
    && work.isListed
    && work.missingSince === null
    && work.imageUrl?.trim()
    && work.affiliateUrl?.trim()
    && typeof work.price === "number"
    && Number.isFinite(work.price)
    && work.price >= 1,
  );
}

export function getAmateurWorkSitemapPaths(totalCount: number, pageSize = AMATEUR_WORK_SITEMAP_PAGE_SIZE): string[] {
  if (!Number.isFinite(totalCount) || !Number.isFinite(pageSize) || pageSize < 1) return [];
  const pageCount = Math.ceil(Math.max(0, Math.trunc(totalCount)) / Math.trunc(pageSize));
  return Array.from({ length: pageCount }, (_, index) => `/sitemaps/amateur-works-${index + 1}.xml`);
}
