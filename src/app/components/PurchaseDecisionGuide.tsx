import Link from "next/link";
import type { PurchaseDecision } from "@/lib/analyzers/purchaseDecisionAnalyzer";

type Props = {
  decision: PurchaseDecision;
  hasAlternatives: boolean;
};

export default function PurchaseDecisionGuide({ decision, hasAlternatives }: Props) {
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm" aria-labelledby="purchase-decision-title">
      <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-5 sm:px-7">
        <p className="text-xs font-black text-emerald-700">購入前のデータ確認</p>
        <h2 id="purchase-decision-title" className="mt-1 text-2xl font-black text-zinc-900">
          {decision.verdict}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-zinc-600 sm:text-base">
          {decision.summary}
        </p>
      </div>

      {decision.evidence.length > 0 && (
        <dl className="grid border-b border-zinc-100 sm:grid-cols-3">
          {decision.evidence.map((item, index) => (
            <div key={item.label} className={`px-4 py-5 sm:px-7 ${index > 0 ? "border-t border-zinc-100 sm:border-l sm:border-t-0" : ""}`}>
              <dt className="text-xs font-bold text-zinc-500">{item.label}</dt>
              <dd className="mt-1 text-xl font-black text-zinc-900">{item.value}</dd>
              <dd className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid gap-6 px-4 py-6 sm:px-7 lg:grid-cols-2">
        {decision.suitedFor.length > 0 && (
          <div>
            <h3 className="text-base font-black text-zinc-900">この作品が候補になりやすい人</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
              {decision.suitedFor.map((item) => (
                <li key={item} className="flex gap-2"><span className="font-black text-emerald-600" aria-hidden="true">✓</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-base font-black text-zinc-900">購入前に確認したい点</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
            {decision.cautions.map((item) => (
              <li key={item} className="flex gap-2"><span className="font-black text-amber-600" aria-hidden="true">!</span><span>{item}</span></li>
            ))}
          </ul>
          {hasAlternatives && (
            <Link href="#value-alternatives" className="mt-4 inline-flex text-sm font-black text-pink-600 hover:underline">
              同価格帯の候補と比較する
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
