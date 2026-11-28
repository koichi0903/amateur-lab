export type SaleValueCampaign = {
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  startsAtLabel: string;
  endsAtLabel: string;
  /** The timestamp as stored in public.works.sale_end_at (UTC wall-clock). */
  saleEndAtStored: string;
  salePrice: number;
  description: string;
};

/**
 * Campaign configuration is intentionally separate from rendering. To reuse
 * this page for another sale, add a definition with that campaign's stored
 * end timestamp, price, period labels, and public slug.
 */
export const saleValueCampaigns: SaleValueCampaign[] = [
  {
    slug: "100yen-2026-first-wave",
    name: "厳選！ビデオ100円セール 第1弾",
    startsAt: "2026-11-26T15:00:00Z",
    endsAt: "2026-11-29T14:59:00Z",
    startsAtLabel: "2026年11月27日",
    endsAtLabel: "2026年11月29日 23:59（日本時間）",
    saleEndAtStored: "2026-11-29T14:59:00",
    salePrice: 100,
    description:
      "定価比の割引率だけではなく、発掘LABが記録した作品ごとの最安値と現在価格を比較し、お得度順に並べたセール特集です。",
  },
];

export function getSaleValueCampaign(slug: string) {
  return saleValueCampaigns.find((campaign) => campaign.slug === slug) ?? null;
}


/**
 * When campaigns overlap, show the one with the newest start time.
 * Slug order is a deterministic tie-breaker for campaigns starting together.
 */
export function getActiveSaleValueCampaign(now = new Date()) {
  return saleValueCampaigns
    .filter((campaign) => {
      const startsAt = Date.parse(campaign.startsAt);
      const endsAt = Date.parse(campaign.endsAt);
      return Number.isFinite(startsAt) && Number.isFinite(endsAt) && now.getTime() >= startsAt && now.getTime() <= endsAt;
    })
    .sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt) || left.slug.localeCompare(right.slug))[0] ?? null;
}
