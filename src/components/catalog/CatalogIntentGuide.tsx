import Link from "next/link";
import { ArrowRight, CheckCircle2, GitCompareArrows } from "lucide-react";
import type { AffiliateSource } from "@/lib/affiliateTracking";
import { workDetailHref } from "@/lib/affiliateTracking";
import type { CatalogIntentAnalysis } from "@/lib/catalog/catalogIntentAnalyzer";

export default function CatalogIntentGuide({
  name,
  source,
  analysis,
}: {
  name: string;
  source: AffiliateSource;
  analysis: CatalogIntentAnalysis | null;
}) {
  if (!analysis) return null;

  return (
    <section className="mb-10 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm" aria-labelledby="catalog-intent-title">
      <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-6 sm:px-7">
        <p className="flex items-center gap-2 text-xs font-black text-emerald-700"><GitCompareArrows size={15} />データで比較</p>
        <h2 id="catalog-intent-title" className="mt-2 break-words text-2xl font-black text-slate-950">{name}のおすすめ作品の選び方</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">{analysis.summary}</p>
      </div>

      {analysis.highlights.length > 0 && (
        <dl className="grid border-b border-slate-100 lg:grid-cols-3">
          {analysis.highlights.map((highlight, index) => (
            <div key={highlight.label} className={`min-w-0 px-5 py-5 sm:px-7 ${index > 0 ? "border-t border-slate-100 lg:border-l lg:border-t-0" : ""}`}>
              <dt className="text-xs font-bold text-slate-500">{highlight.label}</dt>
              <dd className="mt-1 text-xl font-black text-slate-950">{highlight.value}</dd>
              <dd className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{highlight.detail}</dd>
              <dd><Link href={workDetailHref(highlight.workId, source)} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-pink-600 hover:underline">作品を確認 <ArrowRight size={13} /></Link></dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid gap-7 px-5 py-6 sm:px-7 lg:grid-cols-2">
        <div>
          <h3 className="text-base font-black text-slate-950">比較するときの目安</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {analysis.selectionPoints.map((point) => (
              <li key={point} className="flex gap-2"><CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={16} /><span>{point}</span></li>
            ))}
          </ul>
          {!analysis.selectionPoints.length && <p className="mt-3 text-sm leading-6 text-slate-500">比較できる価格・レビュー情報を収集中です。</p>}
        </div>

        {analysis.related.length > 0 && (
          <div>
            <h3 className="text-base font-black text-slate-950">関連する条件から探す</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {analysis.related.map((item) => (
                <Link key={`${item.kind}-${item.name}`} href={`/${item.kind}/${encodeURIComponent(item.name)}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-pink-300 hover:text-pink-600">
                  {item.label}: {item.name} <span className="text-slate-400">({item.count})</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
