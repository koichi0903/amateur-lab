import AffiliateLink from "./AffiliateLink";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import CompareButton from "@/components/comparison/CompareButton";
import type {
  PricedPurchaseOffer,
} from "@/lib/purchaseCardPricing";

type PurchasePriceSummaryProps = {
  bestOffer: PricedPurchaseOffer | null;
  currentPrice: number | null;
  regularPrice: number | null;
  discountRate: number;
  saleEnd: string | null;
  decisionFacts: string[];
  sortedOffers: PricedPurchaseOffer[];
};

export function PurchasePriceSummary({
  bestOffer,
  currentPrice,
  regularPrice,
  discountRate,
  saleEnd,
  decisionFacts,
  sortedOffers,
}: PurchasePriceSummaryProps) {
  return (
    <>
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
                key={`${offer.type ?? ""}-${offer.display_name ?? index}-${offer.period ?? ""}`}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate font-bold text-zinc-600">
                  {offer.display_name ?? offer.type ?? "販売価格"}
                  {offer.period ? `（${offer.period}）` : ""}
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
    </>
  );
}

type PurchaseActionsProps = {
  workId: number;
  affiliateUrl: string | null;
  checkedLabel: string | null;
};

export function PurchaseActions({
  workId,
  affiliateUrl,
  checkedLabel,
}: PurchaseActionsProps) {
  return (
    <>
      {affiliateUrl ? (
        <AffiliateLink
          href={affiliateUrl}
          workId={workId}
          placement="detail-sidebar"
          experiment
          variantChildren={{
            "price-focus": "FANZA公式で最安価格を確認",
          }}
          ariaLabel="FANZA公式で価格とサンプルを確認する（新しいタブで開きます）"
          className="mt-6 block w-full rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-4 text-center text-base font-black text-white shadow-md transition hover:scale-[1.02] hover:shadow-lg"
        >
          FANZA公式で確認
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
        workId={workId}
        addLabel="お気に入り"
        className="mt-4 w-full rounded-xl border py-3 font-semibold hover:bg-zinc-50"
      />
      <CompareButton
        workId={workId}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-700 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700"
      />
    </>
  );
}

export function PurchaseRanking({ ranking }: { ranking: number | null }) {
  if (typeof ranking !== "number" || ranking <= 0 || ranking >= 9999) {
    return null;
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-sm font-bold text-zinc-500">人気ランキング</div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-zinc-500">現在順位</span>
        <span className="text-4xl font-black text-pink-600">#{ranking}</span>
      </div>
    </section>
  );
}
