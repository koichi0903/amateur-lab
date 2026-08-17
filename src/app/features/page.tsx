import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LibraryBig } from "lucide-react";
import Header from "@/components/layout/Header";
import { featureCategories, type FeatureCategory } from "@/lib/features";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "FANZA作品選びの特集 | 発掘LAB", description: "初心者向け、500円以下、レビュー重視、女優から発掘、隠れた名作など、目的別のFANZA作品特集です。", canonical: "/features" });

export default function FeaturesPage() {
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP <span className="mx-1">/</span> 特集</Link><div className="mt-5 flex items-start gap-4"><span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><LibraryBig size={30} /></span><div><p className="text-xs font-black tracking-[0.18em] text-indigo-600">EDITORIAL PICKS</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">目的別の作品特集</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">価格だけ、評価だけで決めず、自分の選び方に合う入口から作品を比較できます。</p></div></div></div></section><section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:py-16"><div className="grid gap-4 md:grid-cols-2">{(Object.entries(featureCategories) as [FeatureCategory, (typeof featureCategories)[FeatureCategory]][]).map(([key, item]) => { const Icon = item.icon; return <Link key={key} href={`/features/${key}`} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg"><span className="inline-flex rounded-2xl bg-pink-50 p-3 text-pink-600"><Icon size={26} /></span><p className="mt-5 text-xs font-black tracking-widest text-pink-600">{item.label}</p><h2 className="mt-2 text-2xl font-black">{item.title}</h2><p className="mt-3 text-sm leading-7 text-slate-500">{item.description}</p><span className="mt-5 flex items-center gap-1 text-sm font-black text-pink-600">特集を見る <ArrowRight size={16} /></span></Link>; })}</div></section></main></>;
}
