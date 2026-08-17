import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import DealWorkCard from "@/components/deals/DealWorkCard";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import { dealCategories, isDealCategory } from "@/lib/deals";
import { getDeals } from "@/lib/getDeals";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 900;
const PAGE_SIZE = 30;

function parsePage(value?: string) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function generateStaticParams() {
  return Object.keys(dealCategories).map((category) => ({ category }));
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const { category } = await params;
  if (!isDealCategory(category)) return {};
  const page = parsePage((await searchParams).page);
  const item = dealCategories[category];
  return pageMetadata({
    title: `${item.title}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: item.description,
    canonical: page > 1 ? `/deals/${category}?page=${page}` : `/deals/${category}`,
  });
}

export default async function DealCategoryPage({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> }) {
  const { category } = await params;
  if (!isDealCategory(category)) notFound();
  const page = parsePage((await searchParams).page);
  const offset = (page - 1) * PAGE_SIZE;
  const item = dealCategories[category];
  const Icon = item.icon;
  const result = await getDeals(category, offset, offset + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil(result.count / PAGE_SIZE));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title={item.title}
          description={item.description}
          url={`${SITE_URL}/deals/${category}${page > 1 ? `?page=${page}` : ""}`}
          items={result.works.map((work) => ({
            name: work.title,
            url: `${SITE_URL}/works/${work.id}`,
            image: work.image_url,
          }))}
        />
        <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><Link href="/deals" className="text-xs font-bold text-slate-500 hover:text-pink-600">お得に探す <span className="mx-1">/</span> {item.label}</Link><div className="mt-5 flex max-w-4xl items-start gap-4"><span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><Icon size={30} /></span><div><p className="text-xs font-black tracking-[0.18em] text-pink-600">SMART DEALS</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{item.title}</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{item.description}</p></div></div></div></section>
        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-10 grid gap-3 rounded-3xl border border-pink-100 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-2xl bg-pink-50 p-5"><p className="text-xs font-black tracking-widest text-pink-700">買い時チェック</p><ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-700">{item.decisionGuide.map((guide) => <li key={guide}>✓ {guide}</li>)}</ul></div>
            <div className="rounded-2xl bg-amber-50 p-5"><p className="text-xs font-black tracking-widest text-amber-700">購入前に確認</p><p className="mt-3 text-sm font-bold leading-7 text-slate-700">{item.caution}</p></div>
          </div>
          <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-pink-600">CURATED PICKS</p><h2 className="mt-1 text-2xl font-black">該当作品一覧</h2></div><span className="text-xs font-bold text-slate-500">全{result.count.toLocaleString("ja-JP")}作品</span></div>
          {result.error ? <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center font-black">作品を読み込めませんでした</div> : result.works.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{result.works.map((work) => <DealWorkCard key={work.id} work={work} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center font-black">現在、該当する作品はありません</div>}
          {totalPages > 1 && <nav aria-label="ページ送り" className="mt-10 flex items-center justify-center gap-3">{page > 1 && <Link href={page === 2 ? `/deals/${category}` : `/deals/${category}?page=${page - 1}`} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black"><ArrowLeft size={15} />前へ</Link>}<span className="text-xs font-bold text-slate-500">{page} / {totalPages}</span>{page < totalPages && <Link href={`/deals/${category}?page=${page + 1}`} className="flex items-center gap-1 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ<ArrowRight size={15} /></Link>}</nav>}
        </section>
      </main>
    </>
  );
}
