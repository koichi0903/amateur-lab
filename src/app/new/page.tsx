import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";

export const revalidate = 300;
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const requestedPage = Number.parseInt((await searchParams).page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1;
  return {
    title: `新着作品${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "発売日の新しいFANZA作品を発掘スコアとともに紹介します。",
    alternates: { canonical: page > 1 ? `/new?page=${page}` : "/new" },
  };
}
const PAGE_SIZE = 48;

function formatDate(value: string | null) {
  if (!value) return "発売日未取得";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function WorkCard({ work }: { work: Work }) {
  const price = work.sale_price > 0 ? work.sale_price : work.price;
  return <Link href={`/works/${work.id}`} className="group grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-pink-200 hover:shadow-lg sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5 sm:p-4">
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={work.image_url} alt={work.title} sizes="160px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" /></div>
    <div className="flex min-w-0 flex-col"><div className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-[11px] font-black text-slate-500">{formatDate(work.release_date ?? work.product_release_date)}</span><span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-black text-pink-600">NEW</span></div><h2 className="mt-2 line-clamp-3 break-all text-sm font-black leading-5 sm:text-base sm:leading-6">{work.title}</h2><div className="mt-3 flex items-baseline gap-1.5 text-pink-600"><span className="text-[10px] font-black tracking-wider">SCORE</span><strong className="text-2xl leading-none">{work.score > 0 ? work.score : "—"}</strong></div><div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-black sm:text-sm"><span className={work.sale_price > 0 ? "text-rose-600" : price > 0 ? "text-slate-900" : "text-slate-400"}>{price > 0 ? `¥${price.toLocaleString("ja-JP")}` : "価格未取得"}</span><span className="flex shrink-0 items-center gap-1 text-pink-600">詳細 <ArrowRight size={14} /></span></div></div>
  </Link>;
}

export default async function NewPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let offset = (page - 1) * PAGE_SIZE;
  let response = await supabase.from("works").select("*", { count: "exact" }).eq("stage", "NEW").order("release_date", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
  const total = response.count ?? response.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  if (currentPage !== page) {
    offset = (currentPage - 1) * PAGE_SIZE;
    response = await supabase.from("works").select("*", { count: "exact" }).eq("stage", "NEW").order("release_date", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
  }
  const works = (response.data ?? []) as Work[];
  const error = response.error;
  const href = (target: number) => target > 1 ? `/new?page=${target}` : "/new";

  return <><Header /><main className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950"><section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP <span className="mx-1">/</span> 新着</Link><div className="mt-5 flex max-w-3xl items-start gap-4"><span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><CalendarDays size={28} /></span><div className="min-w-0"><p className="text-xs font-black tracking-[0.18em] text-pink-600">NEW RELEASES</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">新着作品を発掘</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">新着ステージの作品を発売日の新しい順に紹介します。</p></div></div></div></section><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-pink-600">LATEST WORKS</p><h2 className="mt-1 text-2xl font-black">新着作品一覧</h2></div><span className="shrink-0 text-xs font-bold text-slate-400">全{total}作品</span></div>{error ? <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black">新着作品を読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div> : works.length ? <div className="grid gap-3 lg:grid-cols-2">{works.map((work) => <WorkCard key={work.id} work={work} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-14"><Sparkles className="mx-auto text-slate-300" size={40} /><p className="mt-4 font-black">現在表示できる新着作品はありません</p></div>}{totalPages > 1 && <nav aria-label="新着作品のページ送り" className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={href(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={href(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}</nav>}</div></main></>;
}
