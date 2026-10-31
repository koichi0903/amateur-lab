import type { RecommendReason } from "@/lib/analyzers/recommendAnalyzer";
import { formatJapanDateTime } from "@/lib/dateTime";
import {
  buildPurchaseDecisionFacts,
  calculatePurchaseCardPricing,
  type PurchasePriceOffer,
} from "@/lib/purchaseCardPricing";
import {
  PurchaseActions,
  PurchasePriceSummary,
  PurchaseRanking,
} from "./PurchaseCardSections";

type Props = {
  work: {
    id: number;
    affiliate_url: string | null;
    sale_price: number | null;
    price: number | null;
    list_price: number | null;
    discount_rate: number | null;
    ranking: number | null;
    lowest_price: number | null;
    is_on_sale: boolean | null;
    review_average: number | null;
    review_count: number | null;
    sale_end_at: string | null;
  };
  offers?: PurchasePriceOffer[];
  checkedAt?: string | null;
  sampleMovieAvailable?: boolean;
  recommendationReasons?: RecommendReason[];
};

export default function PurchaseCard({
  work,
  offers = [],
  checkedAt,
  sampleMovieAvailable = false,
  recommendationReasons = [],
}: Props) {
  const {
    sortedOffers,
    bestOffer,
    currentPrice,
    regularPrice,
    discountRate,
    isLowestPrice,
  } = calculatePurchaseCardPricing(work, offers);
  const saleEnd = work.is_on_sale ? formatJapanDateTime(work.sale_end_at) : null;
  const checkedLabel = formatJapanDateTime(checkedAt);
  const affiliateUrl = work.affiliate_url?.trim() || null;
  const decisionFacts = buildPurchaseDecisionFacts({
    isLowestPrice,
    sampleMovieAvailable,
    reviewAverage: work.review_average,
    reviewCount: work.review_count,
    recommendationTitle: recommendationReasons[0]?.title,
  });

  return (
    <aside className="sticky top-6 hidden space-y-5 lg:block">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <PurchasePriceSummary
          bestOffer={bestOffer}
          currentPrice={currentPrice}
          regularPrice={regularPrice}
          discountRate={discountRate}
          saleEnd={saleEnd}
          decisionFacts={decisionFacts}
          sortedOffers={sortedOffers}
        />
        <PurchaseActions
          workId={work.id}
          affiliateUrl={affiliateUrl}
          checkedLabel={checkedLabel}
        />
      </section>

      <p className="px-2 text-[10px] leading-5 text-zinc-500">
        ※当サイトはアフィリエイト広告を利用しています。リンク経由の購入で運営者に報酬が入る場合がありますが、購入価格は変わりません。
      </p>

      <PurchaseRanking ranking={work.ranking} />
    </aside>
  );
}
