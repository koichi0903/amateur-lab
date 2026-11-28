export type SaleValueCampaign = {
  slug: string;
  name: string;
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
