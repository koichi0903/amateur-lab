import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "編集・データ更新方針 | 発掘LAB", description: "発掘LABの記事、ランキング、価格、AI利用、訂正の方針を説明します。", canonical: "/editorial-policy" });

export default function EditorialPolicyPage() {
  const sections = [
    ["誰が制作するか", "発掘LAB編集部が、作品データの取得条件、比較基準、ページ表示を確認して公開します。ガイドでは判断手順を説明し、個人の体験を装った表現は使用しません。"],
    ["どのように制作するか", "作品情報、価格、レビュー、ランキング、セール、サンプルの取得データを比較します。記事構成や文章整理にAIを利用する場合がありますが、順位や価格をAIの推測だけで作成しません。"],
    ["おすすめ順位の考え方", "発掘スコア、レビュー平均と件数、現在価格、値引率、ランキング、発売時期などを組み合わせます。広告料の追加支払いによって個別作品の順位を販売しません。"],
    ["更新と訂正", "価格・順位などの変動データは定期更新します。販売条件は変わるため、購入直前の公式情報を優先してください。誤りを確認した場合はデータまたは本文を修正します。"],
  ] as const;
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><div className="mx-auto max-w-[900px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/" className="text-xs font-bold text-slate-500">TOP / 編集方針</Link><p className="mt-7 text-xs font-black tracking-widest text-indigo-600">EDITORIAL POLICY</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">編集・データ更新方針</h1><p className="mt-5 text-base leading-8 text-slate-600">発掘LABが、誰のために、どのデータを使い、どのように記事とランキングを制作するかを説明します。</p><div className="mt-12 divide-y divide-slate-200 border-y border-slate-200 bg-white">{sections.map(([title, body]) => <section key={title} className="px-5 py-7 sm:px-7"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 text-sm leading-8 text-slate-700">{body}</p></section>)}</div><p className="mt-8 text-sm text-slate-600">広告については <Link href="/affiliate-disclosure" className="font-black text-pink-700 underline">広告・アフィリエイト方針</Link> もご確認ください。</p></div></main></>;
}
