import AffiliateLink from "@/app/components/AffiliateLink";
import type { AffiliateSource } from "@/lib/affiliateTracking";
import type { BuyTimingResult } from "@/lib/buyTiming";

type Props = {
  decision: BuyTimingResult;
  discoveryScore: number | null;
  workId: number;
  affiliateUrl: string | null;
  sourcePage: AffiliateSource;
};

const evaluationToneClasses = {
  strong: "border-pink-200 bg-pink-50 text-pink-700",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  compare: "border-amber-200 bg-amber-50 text-amber-800",
  watch: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

function getEvaluation(score: number | null) {
  if (typeof score !== "number") {
    return {
      label: "比較して判断",
      description: "価格・レビューを確認して判断したい作品",
      tone: "watch" as const,
    };
  }

  if (score >= 85) {
    return {
      label: "かなりおすすめ",
      description: "高評価・信頼十分で、発掘余地も強い候補",
      tone: "strong" as const,
    };
  }

  if (score >= 75) {
    return {
      label: "おすすめ",
      description: "発掘候補として十分チェックしたい作品",
      tone: "good" as const,
    };
  }

  if (score >= 60) {
    return {
      label: "条件次第",
      description: "好みや価格条件が合えば候補に入る作品",
      tone: "compare" as const,
    };
  }

  return {
    label: "様子見",
    description: "ほかの候補と比較して判断したい作品",
    tone: "watch" as const,
  };
}

function normalizeReasonFact(reason: string) {
  if (reason.includes("発掘スコア")) return null;
  if (reason.includes("CTR")) return null;
  if (reason.includes("過去最安値クラス")) return "過去最安値クラス";
  if (reason.includes("過去最安値に近い")) return "過去最安値に近い";
  if (reason.includes("OFF")) return reason.match(/\d+%OFF/)?.[0] ?? reason;
  if (reason.includes("レビュー")) return reason.replace("レビュー", "★");
  return reason;
}

function formatPrice(value: number | null) {
  return value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "確認中";
}

export default function BuyTimingPanel({
  decision,
  discoveryScore,
  workId,
  affiliateUrl,
  sourcePage,
}: Props) {
  const link = affiliateUrl?.trim() || null;
  const evaluation = getEvaluation(discoveryScore);
  const reasonFacts = [
    decision.discountRate > 0 ? `${decision.discountRate}%OFF` : null,
    decision.lowestPriceComparison === "lowest" ? "過去最安値クラス" : null,
    decision.lowestPriceComparison === "near_lowest" ? "過去最安値に近い" : null,
    ...decision.reasons.map(normalizeReasonFact),
  ]
    .filter((reason): reason is string => Boolean(reason))
    .filter((reason, index, reasons) => reasons.indexOf(reason) === index)
    .slice(0, 4);

  return (
    <section className="mt-6 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-widest text-pink-600">発掘LAB評価</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-4 py-2 text-base font-black ${evaluationToneClasses[evaluation.tone]}`}>
                  {evaluation.label}
                </span>
                <span className="text-sm font-bold text-zinc-600">{evaluation.description}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-pink-50 p-3">
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

          {reasonFacts.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black tracking-widest text-emerald-600">今買う理由</p>
              <ul className="mt-2 grid gap-2 text-sm font-bold text-zinc-700 sm:grid-cols-2">
                {reasonFacts.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="text-emerald-600" aria-hidden="true">✓</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-bold leading-6 text-amber-800">
            {decision.lowestPriceText}
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
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-4 text-center text-base font-black leading-6 text-white shadow-md transition hover:scale-[1.01] hover:shadow-lg lg:h-full"
            >
              FANZAで価格・サンプルを確認
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
