import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";
import { workDetailHref } from "@/lib/affiliateTracking";

export const revalidate = 1800;
type NewParams = { page?: string; sort?: string; maxPrice?: string; sample?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<NewParams> }): Promise<Metadata> {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1;
  return pageMetadata({
    title: `新着作品${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "発売日の新しいFANZA作品を発掘スコアとともに紹介します。",
    canonical: page > 1 ? `/new?page=${page}` : "/new",
    robots: params.sort || params.maxPrice || params.sample ? { index: false, follow: true } : undefined,
  });
}
const PAGE_SIZE = 48;

function formatDate(value: string | null) {
  if (!value) return "発売日未取得";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function WorkCard({ work }: { work: Work }) {
  const price = work.sale_price > 0 ? work.sale_price : work.price;
  return <Link href={workDetailHref(work.id, "new")} className="group grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-pink-200 hover:shadow-lg sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5 sm:p-4">
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={work.image_url} alt={work.title} sizes="160px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" /></div>
    <div className="flex min-w-0 flex-col"><div className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-[11px] font-black text-slate-500">{formatDate(work.release_date ?? work.product_release_date)}</span><span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-black text-pink-600">NEW</span></div><h2 className="mt-2 line-clamp-3 break-all text-sm font-black leading-5 sm:text-base sm:leading-6">{work.title}</h2><div className="mt-3 flex items-baseline gap-1.5 text-pink-600"><span className="text-[10px] font-black tracking-wider">発掘スコア</span><strong className="text-2xl leading-none">{work.score > 0 ? work.score : "—"}</strong></div><div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-black sm:text-sm"><span className={work.sale_price > 0 ? "text-rose-600" : price > 0 ? "text-slate-900" : "text-slate-400"}>{price > 0 ? `¥${price.toLocaleString("ja-JP")}` : "価格未取得"}</span><span className="flex shrink-0 items-center gap-1 text-pink-600">価格・詳細 <ArrowRight size={14} /></span></div></div>
  </Link>;
}

export default async function NewPage({ searchParams }: { searchParams: Promise<NewParams> }) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sort = params.sort === "score" ? "score" : "date";
  const maxPrice = Number(params.maxPrice) > 0 ? Number(params.maxPrice) : null;
  const sampleOnly = params.sample === "1";
  let offset = (page - 1) * PAGE_SIZE;
  const buildQuery = () => {
    let query = supabase.from("works").select("id,title,image_url,score,price,sale_price,release_date,product_release_date,sample_movie_url", { count: "exact" }).eq("stage", "NEW");
    if (maxPrice) query = query.or(`and(sale_price.gt.0,sale_price.lte.${maxPrice}),and(sale_price.eq.0,price.lte.${maxPrice})`);
    if (sampleOnly) query = query.not("sample_movie_url", "is", null).neq("sample_movie_url", "");
    return sort === "score" ? query.order("score", { ascending: false, nullsFirst: false }).order("release_date", { ascending: false }) : query.order("release_date", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
  };
  let response = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
  const total = response.count ?? response.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  if (currentPage !== page) {
    offset = (currentPage - 1) * PAGE_SIZE;
    response = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
  }
  const works = (response.data ?? []) as unknown as Work[];
  const error = response.error;
  const href = (target: number) => { const query = new URLSearchParams(); if (target > 1) query.set("page", String(target)); if (sort !== "date") query.set("sort", sort); if (maxPrice) query.set("maxPrice", String(maxPrice)); if (sampleOnly) query.set("sample", "1"); return query.size ? `/new?${query}` : "/new"; };

  return <><Header /><main className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950"><section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP <span className="mx-1">/</span> 新着</Link><div className="mt-5 flex max-w-3xl items-start gap-4"><span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><CalendarDays size={28} /></span><div className="min-w-0"><p className="text-xs font-black tracking-[0.18em] text-pink-600">NEW RELEASES</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">新着作品を発掘</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">新着ステージの作品を発売日の新しい順に紹介します。</p></div></div></div></section><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><form action="/new" className="mb-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]"><label className="text-xs font-black text-slate-600">並び順<select name="sort" defaultValue={sort} className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="date">発売日が新しい順</option><option value="score">発掘スコア順</option></select></label><label className="text-xs font-black text-slate-600">上限価格<select name="maxPrice" defaultValue={maxPrice ?? ""} className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="1000">1,000円以下</option><option value="2000">2,000円以下</option><option value="3000">3,000円以下</option></select></label><label className="flex h-11 items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-sm font-black"><input type="checkbox" name="sample" value="1" defaultChecked={sampleOnly} className="h-4 w-4 accent-pink-600" />サンプルあり</label><button type="submit" className="h-11 self-end rounded-xl bg-slate-950 px-6 text-sm font-black text-white hover:bg-pink-600">絞り込む</button></form><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-pink-600">LATEST WORKS</p><h2 className="mt-1 text-2xl font-black">新着作品一覧</h2></div><span className="shrink-0 text-xs font-bold text-slate-400">全{total}作品</span></div>{error ? <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black">新着作品を読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div> : works.length ? <div className="grid gap-3 lg:grid-cols-2">{works.map((work) => <WorkCard key={work.id} work={work} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-14"><Sparkles className="mx-auto text-slate-300" size={40} /><p className="mt-4 font-black">現在表示できる新着作品はありません</p></div>}{totalPages > 1 && <nav aria-label="新着作品のページ送り" className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={href(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={href(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}</nav>}</div></main></>;
}
