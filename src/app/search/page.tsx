import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { workDetailHref } from "@/lib/affiliateTracking";

export const metadata: Metadata = pageMetadata({ title: "作品検索 | 発掘LAB", description: "作品名、女優、メーカー、シリーズ、ジャンルからFANZA作品を検索できます。", canonical: "/search", robots: { index: false, follow: true } });

const SEARCH_COLUMNS = ["title", "actress", "maker", "series", "genre"] as const;
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 60;

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function quoteFilterValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

type SearchParams = { q?: string; sort?: string; maxPrice?: string; sale?: string; sample?: string };

async function searchWorks(query: string, params: SearchParams) {
  if (!query) return { works: [] as Work[], error: null };

  const pattern = `%${escapeLikePattern(query)}%`;
  const filter = SEARCH_COLUMNS
    .map((column) => `${column}.ilike.${quoteFilterValue(pattern)}`)
    .join(",");
  let worksQuery = supabase
    .from("works")
    .select("id,title,image_url,score,price,sale_price,actress,maker,series,genre,sample_movie_url,review_average,review_count")
    .or(filter);

  const maxPrice = Number(params.maxPrice) > 0 ? Number(params.maxPrice) : null;
  if (maxPrice) worksQuery = worksQuery.or(`and(sale_price.gt.0,sale_price.lte.${maxPrice}),and(sale_price.eq.0,price.lte.${maxPrice})`);
  if (params.sale === "1") worksQuery = worksQuery.gt("sale_price", 0);
  if (params.sample === "1") worksQuery = worksQuery.not("sample_movie_url", "is", null).neq("sample_movie_url", "");
  if (params.sort === "price") worksQuery = worksQuery.order("sale_price", { ascending: true, nullsFirst: false }).order("price", { ascending: true });
  else if (params.sort === "review") worksQuery = worksQuery.order("review_average", { ascending: false }).order("review_count", { ascending: false });
  else worksQuery = worksQuery.order("score", { ascending: false, nullsFirst: false });

  const response = await worksQuery.limit(MAX_RESULTS);

  return { works: (response.data ?? []) as unknown as Work[], error: response.error };
}

function currentPrice(work: Work) {
  return work.sale_price > 0 ? work.sale_price : work.price;
}

function splitValues(value: string | null) {
  return value?.split(" / ").map((item) => item.trim()).filter(Boolean) ?? [];
}

function DetailLinks({ work }: { work: Work }) {
  const links = [
    ...splitValues(work.actress).slice(0, 2).map((name) => ({ label: name, href: `/actress/${encodeURIComponent(name)}` })),
    ...(work.maker ? [{ label: work.maker, href: `/maker/${encodeURIComponent(work.maker)}` }] : []),
    ...(work.series ? [{ label: work.series, href: `/series/${encodeURIComponent(work.series)}` }] : []),
    ...splitValues(work.genre).slice(0, 2).map((name) => ({ label: name, href: `/genre/${encodeURIComponent(name)}` })),
  ];

  return (
    <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
      {links.slice(0, 4).map((link) => (
        <Link key={`${link.href}-${link.label}`} href={link.href} className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-pink-50 hover:text-pink-600">
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function WorkCard({ work }: { work: Work }) {
  const price = currentPrice(work);

  return (
    <article className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5 sm:p-4">
      <Link href={workDetailHref(work.id, "search")} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        <WorkImage src={work.image_url} alt={work.title} sizes="160px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
      </Link>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline gap-1.5 text-pink-600">
          <span className="text-[10px] font-black tracking-wider">SCORE</span>
          <strong className="text-2xl leading-none">{work.score > 0 ? work.score : "—"}</strong>
        </div>
        <Link href={workDetailHref(work.id, "search")} className="mt-2 line-clamp-2 break-all text-sm font-black leading-5 text-slate-900 hover:text-pink-600 sm:text-base sm:leading-6">
          {work.title}
        </Link>
        <DetailLinks work={work} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-3 text-xs font-black sm:text-sm">
          <span className={work.sale_price > 0 ? "text-rose-600" : price > 0 ? "text-slate-900" : "text-slate-400"}>
            {price > 0 ? `¥${price.toLocaleString("ja-JP")}` : "価格未取得"}
          </span>
          <Link href={workDetailHref(work.id, "search")} className="flex shrink-0 items-center gap-1 text-pink-600">詳細 <ArrowRight size={14} /></Link>
        </div>
      </div>
    </article>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const { works, error } = await searchWorks(query, params);

  return (
    <>
      <Header />
      <main className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 transition hover:text-pink-600">TOP <span className="mx-1">/</span> 検索</Link>
            <div className="mt-5 flex max-w-3xl items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><Search size={28} /></span>
              <div className="min-w-0"><p className="text-xs font-black tracking-[0.18em] text-pink-600">SEARCH</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">作品を検索</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">作品名を中心に、女優・メーカー・シリーズ・ジャンルから発掘できます。</p></div>
            </div>
            <form action="/search" className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center rounded-2xl border border-slate-300 bg-white px-4 shadow-sm focus-within:border-pink-400 focus-within:ring-4 focus-within:ring-pink-50">
                <Search size={19} className="shrink-0 text-slate-400" />
                <input type="search" name="q" defaultValue={query} maxLength={MAX_QUERY_LENGTH} aria-label="検索語" autoComplete="off" placeholder="作品名・女優・メーカーなど" className="h-14 min-w-0 flex-1 bg-transparent pl-3 text-base outline-none placeholder:text-slate-400" />
              </label>
              <button type="submit" className="h-14 shrink-0 rounded-2xl bg-slate-950 px-8 text-sm font-black text-white shadow-sm transition hover:bg-pink-600">検索する</button>
            </form>
            {query && <form action="/search" className="mt-4 grid max-w-4xl gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]"><input type="hidden" name="q" value={query} /><label className="text-xs font-black text-slate-600">並び順<select name="sort" defaultValue={params.sort ?? "score"} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="score">発掘スコア順</option><option value="price">価格が安い順</option><option value="review">レビュー評価順</option></select></label><label className="text-xs font-black text-slate-600">上限価格<select name="maxPrice" defaultValue={params.maxPrice ?? ""} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="1000">1,000円以下</option><option value="2000">2,000円以下</option><option value="3000">3,000円以下</option></select></label><label className="flex h-10 items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><input type="checkbox" name="sale" value="1" defaultChecked={params.sale === "1"} className="accent-pink-600" />セール</label><label className="flex h-10 items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><input type="checkbox" name="sample" value="1" defaultChecked={params.sample === "1"} className="accent-pink-600" />サンプル</label><button type="submit" className="h-10 self-end rounded-xl bg-pink-600 px-5 text-sm font-black text-white">適用</button></form>}
          </div>
        </section>

        <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {!query ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-14"><Search className="mx-auto text-slate-300" size={40} /><p className="mt-4 font-black">検索語を入力してください</p><p className="mt-2 text-sm leading-6 text-slate-500">日本語の作品名や女優名などから検索できます。</p></div>
          ) : error ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black">検索結果を読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div>
          ) : works.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-14"><Sparkles className="mx-auto text-slate-300" size={40} /><p className="mt-4 break-all font-black">「{query}」に一致する作品はありませんでした</p><p className="mt-2 text-sm leading-6 text-slate-500">検索語を短くするか、別の言葉でお試しください。</p></div>
          ) : (
            <>
              <div className="mb-6 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0"><p className="text-xs font-black tracking-widest text-pink-600">SEARCH RESULTS</p><h2 className="mt-1 break-all text-2xl font-black">「{query}」の検索結果</h2></div>
                <span className="shrink-0 text-xs font-bold text-slate-500">{works.length}件{works.length === MAX_RESULTS ? "（最大60件）" : ""}</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">{works.map((work) => <WorkCard key={work.id} work={work} />)}</div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
