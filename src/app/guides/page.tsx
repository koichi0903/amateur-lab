import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeJapaneseYen, BookOpenCheck, Scale, TrendingDown } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import { editorialGuides } from "@/lib/editorialContent";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FANZA作品の選び方｜価格・過去最安・買い時の購入前ガイド | 発掘LAB",
  description: "FANZA作品を価格、過去最安値、レビュー、セール終了時期、視聴条件から比較。今買うか待つかを判断する購入前ガイドです。",
  canonical: "/guides",
});

export default function GuidesPage() {
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <CollectionPageJsonLd title="FANZA作品の選び方・購入前ガイド" description="作品選びと購入前確認の編集ガイドです。" url={`${SITE_URL}/guides`} items={editorialGuides.map((guide) => ({ name: guide.title, url: `${SITE_URL}/guides/${guide.slug}` }))} />
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP / ガイド</Link><div className="mt-5 flex items-start gap-4"><BookOpenCheck className="mt-1 shrink-0 text-indigo-600" size={34} /><div><p className="text-xs font-black tracking-widest text-indigo-600">BUYING GUIDES</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">FANZA作品の選び方・購入前ガイド</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">価格、過去最安値、レビュー、セール終了時期、視聴条件を確認して、今買うか待つかを判断する順番を整理しています。</p></div></div></div></section>
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:py-16">
      <section aria-labelledby="decision-entries" className="mb-10 rounded-3xl border border-pink-100 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-xs font-black tracking-widest text-pink-600">START WITH A DECISION</p>
        <h2 id="decision-entries" className="mt-2 text-2xl font-black">目的から購入判断ページへ</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">一般的な選び方を読んだ後は、現在の価格データを使って候補を絞れます。気になる作品は詳細ページで価格履歴と公式ページへの導線を確認してください。</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link href="/price-insights" className="group rounded-2xl border border-rose-100 bg-rose-50 p-4 transition hover:border-rose-300"><BadgeJapaneseYen className="text-rose-600" size={22} /><p className="mt-3 font-black">今日の買い時を見る</p><p className="mt-1 text-xs leading-5 text-slate-600">過去最安値・価格推移から判断</p><span className="mt-3 flex items-center gap-1 text-xs font-black text-rose-700">買い時一覧へ <ArrowRight size={14} /></span></Link>
          <Link href="/reports/price-drops" className="group rounded-2xl border border-emerald-100 bg-emerald-50 p-4 transition hover:border-emerald-300"><TrendingDown className="text-emerald-600" size={22} /><p className="mt-3 font-black">価格下落を探す</p><p className="mt-1 text-xs leading-5 text-slate-600">値下げ・過去最安の候補を確認</p><span className="mt-3 flex items-center gap-1 text-xs font-black text-emerald-700">価格レポートへ <ArrowRight size={14} /></span></Link>
          <Link href="/compare-guide" className="group rounded-2xl border border-indigo-100 bg-indigo-50 p-4 transition hover:border-indigo-300"><Scale className="text-indigo-600" size={22} /><p className="mt-3 font-black">候補を比較する</p><p className="mt-1 text-xs leading-5 text-slate-600">価格・レビュー・サンプルを横並びで確認</p><span className="mt-3 flex items-center gap-1 text-xs font-black text-indigo-700">比較方法へ <ArrowRight size={14} /></span></Link>
        </div>
      </section>
      <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">{editorialGuides.map((guide, index) => <article key={guide.slug} className="grid gap-4 px-5 py-7 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center sm:px-7"><span className="text-3xl font-black text-slate-200">{String(index + 1).padStart(2, "0")}</span><div><p className="text-xs font-black tracking-widest text-indigo-600">{guide.eyebrow}</p><h2 className="mt-1 text-xl font-black sm:text-2xl"><Link href={`/guides/${guide.slug}`} className="hover:text-pink-600">{guide.title}</Link></h2><p className="mt-2 text-sm leading-7 text-slate-600">{guide.description}</p></div><Link href={`/guides/${guide.slug}`} aria-label={`${guide.title}を読む`} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white hover:bg-pink-600"><ArrowRight size={18} /></Link></article>)}</div>
    </div>
  </main></>;
}
