import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Clapperboard, Sparkles, Star, Trophy, Users } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 1800;

function actressNames(value: string | null) {
  return value?.split(" / ").map((name) => name.trim()).filter(Boolean) ?? [];
}

async function getActressWorks(actressName: string) {
  const works: Work[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from("works")
      .select("id,title,image_url,score,review_average,price,sale_price,actress")
      .ilike("actress", `%${actressName}%`)
      .order("score", { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);

    if (result.error) return { works: [], error: result.error };
    const page = (result.data ?? []) as Work[];
    works.push(...page);
    if (page.length < pageSize) break;
  }

  return { works: works.filter((work) => actressNames(work.actress).includes(actressName)), error: null };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const actressName = decodeURIComponent((await params).name);
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  return pageMetadata({ title: `${actressName}の出演作品${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`, description: `${actressName}の出演作品を発掘スコア順に紹介します。`, canonical: `/actress/${encodeURIComponent(actressName)}${page > 1 ? `?page=${page}` : ""}` });
}

function Price({ work }: { work: Work }) {
  const price = work.sale_price > 0 ? work.sale_price : work.price;
  return <span className={work.sale_price > 0 ? "text-rose-600" : "text-slate-900"}>{price > 0 ? `¥${price.toLocaleString("ja-JP")}` : "価格未取得"}</span>;
}

function WorkCard({ work, rank }: { work: Work; rank: number }) {
  return <Link href={`/works/${work.id}`} className="group grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-pink-200 hover:shadow-md sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5 sm:p-4">
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={work.image_url} alt={work.title} sizes="150px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" /><span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white shadow">{rank}</span></div>
    <div className="flex min-w-0 flex-col"><div className="flex items-baseline gap-1.5 text-pink-600"><span className="text-[10px] font-black tracking-wider">SCORE</span><strong className="text-2xl leading-none">{work.score > 0 ? work.score : "—"}</strong></div><h2 className="mt-2 line-clamp-2 text-sm font-black leading-5 sm:text-base sm:leading-6">{work.title}</h2><div className="mt-auto flex items-end justify-between gap-2 pt-3 text-xs font-black sm:text-sm"><Price work={work} /><span className="flex shrink-0 items-center gap-1 text-pink-600">詳細 <ArrowRight size={14} /></span></div></div>
  </Link>;
}

export default async function ActressDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const actressName = decodeURIComponent((await params).name);
  const requestedPage = Number.parseInt((await searchParams).page ?? "1", 10);
  const { works, error } = await getActressWorks(actressName);
  if (!error && works.length === 0) notFound();
  const pageSize = 60;
  const totalPages = Math.max(1, Math.ceil(works.length / pageSize));
  const currentPage = Math.min(Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const displayedWorks = works.slice(offset, offset + pageSize);
  const pageHref = (targetPage: number) => targetPage > 1
    ? `/actress/${encodeURIComponent(actressName)}?page=${targetPage}`
    : `/actress/${encodeURIComponent(actressName)}`;
  const scoredWorks = works.filter((work) => work.score > 0);
  const averageScore = scoredWorks.length ? Math.round(scoredWorks.reduce((sum, work) => sum + work.score, 0) / scoredWorks.length) : 0;
  const reviewedWorks = works.filter((work) => work.review_average > 0);
  const averageReview = reviewedWorks.length ? (reviewedWorks.reduce((sum, work) => sum + work.review_average, 0) / reviewedWorks.length).toFixed(2) : "—";
  const topWork = works[0];

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><div className="text-xs font-bold text-slate-500"><Link href="/" className="hover:text-pink-600">TOP</Link><span className="mx-1">/</span><Link href="/actress" className="hover:text-pink-600">女優</Link><span className="mx-1">/</span>{actressName}</div>
      <div className="mt-6 grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] lg:gap-10"><div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 shadow-sm"><WorkImage src={topWork?.image_url} alt={`${actressName}の出演作品`} sizes="(max-width: 768px) 92vw, 280px" priority unoptimized className="object-cover" /></div><div className="min-w-0"><p className="text-xs font-black tracking-[0.18em] text-pink-600">ACTRESS PROFILE</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{actressName}</h1><p className="mt-4 text-sm leading-7 text-slate-600">出演作品を発掘スコア順に掲載。高評価作品から、この女優の魅力を発掘できます。</p>
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ icon: Clapperboard, label: "登録作品", value: `${works.length}作品` }, { icon: Trophy, label: "最高スコア", value: topWork?.score > 0 ? String(topWork.score) : "—" }, { icon: Sparkles, label: "平均スコア", value: averageScore > 0 ? String(averageScore) : "—" }, { icon: Star, label: "平均レビュー", value: averageReview }].map((stat) => <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><stat.icon size={18} className="text-pink-600" /><p className="mt-3 text-xs font-bold text-slate-500">{stat.label}</p><p className="mt-1 text-xl font-black">{stat.value}</p></div>)}</div>
      </div></div>
    </div></section>
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{error ? <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center font-black">作品を読み込めませんでした</div> : works.length ? <><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-pink-600">WORKS</p><h2 className="mt-1 text-2xl font-black">{actressName}の出演作品</h2></div><span className="text-xs font-bold text-slate-400">全{works.length}作品中 {offset + 1}〜{offset + displayedWorks.length}作品</span></div><div className="grid gap-3 lg:grid-cols-2">{displayedWorks.map((work, index) => <WorkCard key={work.id} work={work} rank={offset + index + 1} />)}</div>{totalPages > 1 && <nav aria-label={`${actressName}の出演作品一覧のページ送り`} className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-pink-300 hover:text-pink-600">← 前の60作品</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-600">次の60作品 →</Link>}</nav>}</> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Users className="mx-auto text-slate-300" size={40} /><p className="mt-4 font-black">登録作品がまだありません</p><Link href="/actress" className="mt-3 inline-block text-sm font-black text-pink-600">女優一覧に戻る</Link></div>}</div>
  </main></>;
}
