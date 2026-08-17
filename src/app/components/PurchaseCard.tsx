import FavoriteButton from "@/components/favorites/FavoriteButton";
import CompareButton from "@/components/comparison/CompareButton";
import type { RecommendReason } from "@/lib/analyzers/recommendAnalyzer";
import AffiliateLink from "./AffiliateLink";
import type { AffiliateSource } from "@/lib/affiliateTracking";

type PriceOffer = {
  display_name: string | null;
  type: string | null;
  normal_price: number | null;
  sale_price: number | null;
};

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
  offers?: PriceOffer[];
  checkedAt?: string | null;
  sampleMovieAvailable?: boolean;
  recommendationReasons?: RecommendReason[];
  sourcePage: AffiliateSource;
};

const effectivePrice = (offer: PriceOffer) =>
  offer.sale_price && offer.sale_price > 0
    ? offer.sale_price
    : offer.normal_price && offer.normal_price > 0
      ? offer.normal_price
      : null;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
};

export default function PurchaseCard({
  work,
  offers = [],
  checkedAt,
  sampleMovieAvailable = false,
  recommendationReasons = [],
  sourcePage,
}: Props) {
  const hasValidRanking =
    typeof work.ranking === "number" &&
    work.ranking > 0 &&
    work.ranking < 9999;
  const sortedOffers = offers
    .map((offer) => ({ ...offer, effectivePrice: effectivePrice(offer) }))
    .filter((offer): offer is PriceOffer & { effectivePrice: number } =>
      offer.effectivePrice !== null
    )
    .sort((a, b) => a.effectivePrice - b.effectivePrice);
  const bestOffer = sortedOffers[0] ?? null;
  const currentPrice =
    bestOffer?.effectivePrice ??
    (work.sale_price && work.sale_price > 0 ? work.sale_price : work.price);
  const regularPrice =
    bestOffer?.normal_price && currentPrice && bestOffer.normal_price > currentPrice
      ? bestOffer.normal_price
      : work.list_price && currentPrice && work.list_price > currentPrice
        ? work.list_price
        : work.price && currentPrice && work.price > currentPrice
          ? work.price
          : null;
  const calculatedDiscount =
    regularPrice && currentPrice
      ? Math.round((1 - currentPrice / regularPrice) * 100)
      : 0;
  const discountRate = Math.max(work.discount_rate ?? 0, calculatedDiscount);
  const isLowestPrice =
    !!currentPrice && !!work.lowest_price && currentPrice <= work.lowest_price;
  const saleEnd = work.is_on_sale ? formatDateTime(work.sale_end_at) : null;
  const checkedLabel = formatDateTime(checkedAt);
  const affiliateUrl = work.affiliate_url?.trim() || null;
  const decisionFacts = [
    isLowestPrice ? "登録以降の最安価格" : null,
    sampleMovieAvailable ? "無料サンプル動画あり" : null,
    work.review_average && work.review_average > 0
      ? `レビュー ${work.review_average.toFixed(2)} / 5（${work.review_count ?? 0}件）`
      : null,
    recommendationReasons[0]?.title ?? null,
  ]
    .filter((fact): fact is string => !!fact)
    .slice(0, 3);

  return (
    <aside className="sticky top-6 hidden space-y-5 lg:block">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-bold text-zinc-500">
          {bestOffer?.display_name
            ? `${bestOffer.display_name}の最安価格`
            : "現在の最安価格"}
        </div>

        <div className="mt-3 text-4xl font-black text-pink-600">
          {currentPrice && currentPrice > 0
            ? `¥${currentPrice.toLocaleString("ja-JP")}`
            : "価格確認中"}
        </div>

        {regularPrice && currentPrice && regularPrice > currentPrice && (
          <>
            <div className="mt-2 text-lg text-zinc-400 line-through">
              通常 ¥{regularPrice.toLocaleString("ja-JP")}
            </div>
            <div className="mt-3 inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-600">
              🔥 {discountRate}%OFF
            </div>
          </>
        )}

        {saleEnd && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            セール終了予定：{saleEnd}
          </p>
        )}

        {decisionFacts.length > 0 && (
          <ul className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-sm font-bold text-zinc-700">
            {decisionFacts.map((fact) => (
              <li key={fact} className="flex gap-2">
                <span className="text-emerald-600" aria-hidden="true">
                  ✓
                </span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        )}

        {sortedOffers.length > 1 && (
          <div className="mt-5 rounded-xl bg-zinc-50 p-3">
            <p className="text-xs font-black text-zinc-500">販売形式を比較</p>
            <div className="mt-2 space-y-2">
              {sortedOffers.slice(0, 4).map((offer, index) => (
                <div
                  key={`${offer.type ?? ""}-${offer.display_name ?? index}`}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 truncate font-bold text-zinc-600">
                    {offer.display_name ?? offer.type ?? "販売価格"}
                    {index === 0 && (
                      <span className="ml-1 text-emerald-600">最安</span>
                    )}
                  </span>
                  <span className="shrink-0 font-black text-zinc-900">
                    ¥{offer.effectivePrice.toLocaleString("ja-JP")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {affiliateUrl ? (
          <AffiliateLink
            href={affiliateUrl}
            workId={work.id}
            placement="detail-sidebar"
            sourcePage={sourcePage}
            experiment
            variantChildren={{
              "price-focus": "FANZA公式で最安価格を確認",
            }}
            ariaLabel="FANZA公式で価格とサンプルを確認する（新しいタブで開きます）"
            className="mt-6 block w-full rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-4 text-center text-base font-black text-white shadow-md transition hover:scale-[1.02] hover:shadow-lg"
          >
            FANZA公式で価格・サンプルを確認
          </AffiliateLink>
        ) : (
          <div className="mt-6 rounded-xl bg-zinc-200 px-4 py-4 text-center text-sm font-bold text-zinc-500">
            販売ページを確認中です
          </div>
        )}

        <p className="mt-3 text-center text-[11px] leading-5 text-zinc-500">
          FANZA公式サイトが別タブで開きます。表示価格・販売状況は公式ページで最終確認してください。
        </p>
        {checkedLabel && (
          <p className="mt-1 text-center text-[10px] text-zinc-400">
            価格データ確認：{checkedLabel}
          </p>
        )}

        <FavoriteButton
          workId={work.id}
          addLabel="お気に入りに追加"
          className="mt-4 w-full rounded-xl border py-3 font-semibold hover:bg-zinc-50"
        />
        <CompareButton
          workId={work.id}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-700 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700"
        />
      </section>

      <p className="px-2 text-[10px] leading-5 text-zinc-500">
        ※当サイトはアフィリエイト広告を利用しています。リンク経由の購入で運営者に報酬が入る場合がありますが、購入価格は変わりません。
      </p>

      {hasValidRanking && (
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-bold text-zinc-500">人気ランキング</div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-zinc-500">現在順位</span>
            <span className="text-4xl font-black text-pink-600">
              #{work.ranking}
            </span>
          </div>
        </section>
      )}
    </aside>
  );
}
