import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import { editorialGuides } from "@/lib/editorialContent";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FANZA作品の選び方・購入前ガイド | 発掘LAB",
  description: "初心者向けの選び方、セール、ランキング、視聴形式、購入方式をデータと確認手順から解説します。",
  canonical: "/guides",
});

export default function GuidesPage() {
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <CollectionPageJsonLd title="FANZA作品の選び方・購入前ガイド" description="作品選びと購入前確認の編集ガイドです。" url={`${SITE_URL}/guides`} items={editorialGuides.map((guide) => ({ name: guide.title, url: `${SITE_URL}/guides/${guide.slug}` }))} />
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP / ガイド</Link><div className="mt-5 flex items-start gap-4"><BookOpenCheck className="mt-1 shrink-0 text-indigo-600" size={34} /><div><p className="text-xs font-black tracking-widest text-indigo-600">BUYING GUIDES</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">作品選びと購入前ガイド</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">ランキングや割引表示だけに頼らず、内容・評価・価格・視聴条件を確認する順番を整理しています。</p></div></div></div></section>
    <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:py-16"><div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">{editorialGuides.map((guide, index) => <article key={guide.slug} className="grid gap-4 px-5 py-7 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center sm:px-7"><span className="text-3xl font-black text-slate-200">{String(index + 1).padStart(2, "0")}</span><div><p className="text-xs font-black tracking-widest text-indigo-600">{guide.eyebrow}</p><h2 className="mt-1 text-xl font-black sm:text-2xl"><Link href={`/guides/${guide.slug}`} className="hover:text-pink-600">{guide.title}</Link></h2><p className="mt-2 text-sm leading-7 text-slate-600">{guide.description}</p></div><Link href={`/guides/${guide.slug}`} aria-label={`${guide.title}を読む`} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white hover:bg-pink-600"><ArrowRight size={18} /></Link></article>)}</div></div>
  </main></>;
}
