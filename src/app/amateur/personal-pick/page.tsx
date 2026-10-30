import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import AmateurPersonalPickClient from "@/components/favorites/AmateurPersonalPickClient";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "素人作品の好み発掘 | 発掘LAB", description: "お気に入りの傾向から、素人作品をおすすめします。", canonical: "/amateur/personal-pick", robots: { index: false, follow: true } });

export default function AmateurPersonalPickRoute() {
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><p className="text-xs font-black tracking-[0.18em] text-violet-600">好み発掘</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">好み発掘</h1><p className="mt-3 text-sm leading-7 text-slate-600">あなたのお気に入りから、ジャンル・メーカー・シリーズ・価格帯・レビュー傾向を分析して素人作品をおすすめします。</p><div className="mt-8"><AmateurPersonalPickClient /></div></div></main></>;
}
