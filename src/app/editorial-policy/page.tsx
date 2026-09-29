import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "編集・データ更新方針 | 発掘LAB", description: "発掘LABの作品情報、価格、レビュー、ランキングの掲載と更新方針を説明します。", canonical: "/editorial-policy" });

export default function EditorialPolicyPage() {
  const sections = [
    ["誰が制作するか", "発掘LAB編集部が、作品データの取得条件、比較基準、ページ表示を確認して公開します。ガイドでは判断手順を説明し、個人の体験を装った表現は使用しません。"],
    ["どのように掲載するか", "作品情報、価格、レビュー、ランキング、セール、サンプルなど、取得できたデータをページごとの目的に合わせて掲載します。表示できない情報は推測で補いません。"],
    ["検索・ランキングの考え方", "検索結果は指定された条件と並び順に従って表示します。ランキングは各ランキングページで定めたデータと集計結果に基づいて表示し、広告料によって個別作品の順位を販売しません。"],
    ["更新と訂正", "価格・順位などの変動データは定期更新します。販売条件は変わるため、購入直前の公式情報を優先してください。誤りを確認した場合はデータまたは本文を修正します。"],
  ] as const;
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><div className="mx-auto max-w-[900px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/" className="text-xs font-bold text-slate-500">TOP / 編集方針</Link><p className="mt-7 text-xs font-black tracking-widest text-indigo-600">EDITORIAL POLICY</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">編集・データ更新方針</h1><p className="mt-5 text-base leading-8 text-slate-600">発掘LABが、作品情報、価格、レビュー、検索結果、ランキングをどのように掲載・更新するかを説明します。</p><div className="mt-12 divide-y divide-slate-200 border-y border-slate-200 bg-white">{sections.map(([title, body]) => <section key={title} className="px-5 py-7 sm:px-7"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 text-sm leading-8 text-slate-700">{body}</p></section>)}</div><p className="mt-8 text-sm text-slate-600">広告については <Link href="/affiliate-disclosure" className="font-black text-pink-700 underline">広告・アフィリエイト方針</Link> もご確認ください。</p></div></main></>;
}
