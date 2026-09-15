import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import { reportDefinitions } from "@/lib/editorialContent";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "FANZA価格・ランキング定点レポート | 発掘LAB", description: "価格下落、ランキング上昇、終了間近のセールを取得データから定期更新します。", canonical: "/reports" });

export default function ReportsPage() {
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><CollectionPageJsonLd title="FANZA価格・ランキング定点レポート" description="価格とランキング変動の定期レポートです。" url={`${SITE_URL}/reports`} items={reportDefinitions.map((report) => ({ name: report.title, url: `${SITE_URL}/reports/${report.slug}` }))} /><section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/" className="text-xs font-bold text-slate-500">TOP / データレポート</Link><div className="mt-6 flex gap-4"><ChartNoAxesCombined className="shrink-0 text-emerald-600" size={36} /><div><p className="text-xs font-black tracking-widest text-emerald-700">DATA REPORTS</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">価格・ランキング定点レポート</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">感想ではなく、取得した価格・順位・セール終了日時から変化の大きい作品をまとめます。</p></div></div></div></section><div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:py-16"><div className="grid gap-4 md:grid-cols-3">{reportDefinitions.map((report, index) => <Link key={report.slug} href={`/reports/${report.slug}`} className="group border-t-4 border-emerald-500 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><p className="text-xs font-black text-emerald-700">REPORT {String(index + 1).padStart(2, "0")}</p><h2 className="mt-3 text-2xl font-black">{report.title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{report.description}</p><span className="mt-6 flex items-center gap-1 text-sm font-black text-pink-600">最新データを見る <ArrowRight size={15} /></span></Link>)}</div><p className="mt-8 text-xs leading-6 text-slate-500">取得データの範囲に基づく比較です。価格、順位、販売状況は変動するため、購入前に公式ページで確認してください。</p></div></main></>;
}
