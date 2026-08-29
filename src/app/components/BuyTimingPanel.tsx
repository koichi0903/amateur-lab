import AffiliateLink from "@/app/components/AffiliateLink";
import type { AffiliateSource } from "@/lib/affiliateTracking";
import type { BuyTimingResult } from "@/lib/buyTiming";

type Props = {
  decision: BuyTimingResult;
  workId: number;
  affiliateUrl: string | null;
  sourcePage: AffiliateSource;
};

const toneClasses: Record<BuyTimingResult["labelTone"], string> = {
  strong: "border-pink-200 bg-pink-50 text-pink-700",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
};

function formatPrice(value: number | null) {
  return value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "確認中";
}

export default function BuyTimingPanel({
  decision,
  workId,
  affiliateUrl,
  sourcePage,
}: Props) {
  const link = affiliateUrl?.trim() || null;

  return (
    <section className="mt-6 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)_260px] lg:items-center">
        <div className="flex items-center gap-4 lg:block lg:text-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[10px] border-pink-500 bg-white shadow-sm lg:mx-auto lg:h-32 lg:w-32">
            <div>
              <div className="text-center text-3xl font-black leading-none text-pink-600 lg:text-4xl">
                {decision.score}
              </div>
              <div className="mt-1 text-center text-[11px] font-bold text-zinc-500">
                /100
              </div>
            </div>
          </div>
          <div className="min-w-0 lg:mt-3">
            <p className="text-xs font-black text-zinc-500">買い時スコア</p>
            <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-black ${toneClasses[decision.labelTone]}`}>
              {decision.label}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-zinc-50 p-3">
              <div className="text-[11px] font-bold text-zinc-500">現在価格</div>
              <div className="mt-1 text-xl font-black text-pink-600">
                {formatPrice(decision.currentPrice)}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3">
              <div className="text-[11px] font-bold text-zinc-500">通常価格</div>
              <div className="mt-1 text-base font-black text-zinc-700">
                {formatPrice(decision.regularPrice)}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3">
              <div className="text-[11px] font-bold text-zinc-500">割引率</div>
              <div className="mt-1 text-base font-black text-red-600">
                {decision.discountRate > 0 ? `${decision.discountRate}%OFF` : "通常価格"}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3">
              <div className="text-[11px] font-bold text-zinc-500">過去最安値</div>
              <div className="mt-1 text-base font-black text-zinc-700">
                {formatPrice(decision.lowestPrice)}
              </div>
            </div>
          </div>

          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-bold leading-6 text-amber-800">
            {decision.lowestPriceText}
          </p>

          {decision.reasons.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black text-zinc-500">今買う理由</p>
              <ul className="mt-2 grid gap-2 text-sm font-bold text-zinc-700 sm:grid-cols-2">
                {decision.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="text-emerald-600" aria-hidden="true">✓</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-5 text-zinc-500">
            直近30日: PV {decision.funnel.pageViews} / FANZAクリック {decision.funnel.fanzaClicks} / 補正CTR {decision.funnel.adjustedCtr}%
          </p>
        </div>

        <div className="lg:self-stretch">
          {link ? (
            <AffiliateLink
              href={link}
              workId={workId}
              placement="buy-timing-panel"
              sourcePage={sourcePage}
              ariaLabel="FANZA公式で現在価格とサンプルを確認する（新しいタブで開きます）"
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-4 text-center text-base font-black text-white shadow-md transition hover:scale-[1.01] hover:shadow-lg lg:h-full"
            >
              FANZAで今の価格を見る
            </AffiliateLink>
          ) : (
            <div className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-zinc-200 px-5 py-4 text-center text-sm font-bold text-zinc-500 lg:h-full">
              販売ページを確認中です
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
