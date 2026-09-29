import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";

export const metadata: Metadata = pageMetadata({ title: "作品検索 | 発掘LAB", description: "作品名、品番、女優、メーカー、シリーズ、ジャンルからFANZA作品を検索できます。", canonical: "/search", robots: { index: false, follow: true } });

const SEARCH_COLUMNS = ["title", "product_id", "actress", "maker", "series", "genre"] as const;
const MAX_QUERY_LENGTH = 100;
const PAGE_SIZE = 24;

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function quoteFilterValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

type SearchParams = { q?: string; genres?: string; sort?: string; releaseFrom?: string; releaseTo?: string; dateStart?: string; dateEnd?: string; minPrice?: string; maxPrice?: string; sale?: string; sample?: string; page?: string };

async function searchWorks(query: string, params: SearchParams) {
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  let worksQuery = supabase
    .from("works")
    .select("id,product_id,title,image_url,score,price,sale_price,list_price,discount_rate,actress,maker,series,genre,sample_movie_url,review_average,review_count,sale_end_at,affiliate_url", { count: "exact" });

  if (query) {
    const pattern = `%${escapeLikePattern(query)}%`;
    const filter = SEARCH_COLUMNS
      .map((column) => `${column}.ilike.${quoteFilterValue(pattern)}`)
      .join(",");
    worksQuery = worksQuery.or(filter);
  }

  const genres = (params.genres ?? "").split(",").map((genre) => genre.trim()).filter(Boolean).slice(0, 20);
  if (genres.length) worksQuery = worksQuery.or(genres.map((genre) => `genre.ilike.${quoteFilterValue(`%${escapeLikePattern(genre)}%`)}`).join(","));
  const releaseFrom = params.releaseFrom ?? params.dateStart;
  const releaseTo = params.releaseTo ?? params.dateEnd;
  if (releaseFrom) worksQuery = worksQuery.gte("release_date", releaseFrom);
  if (releaseTo) worksQuery = worksQuery.lte("release_date", releaseTo);
  const minPrice = Number(params.minPrice) >= 0 && params.minPrice !== "" ? Number(params.minPrice) : null;
  const maxPrice = Number(params.maxPrice) > 0 ? Number(params.maxPrice) : null;
  if (minPrice !== null || maxPrice) {
    const salePrice = ["sale_price.gt.0", minPrice !== null ? `sale_price.gte.${minPrice}` : null, maxPrice ? `sale_price.lte.${maxPrice}` : null].filter(Boolean).join(",");
    const regularPrice = ["sale_price.eq.0", minPrice !== null ? `price.gte.${minPrice}` : null, maxPrice ? `price.lte.${maxPrice}` : null].filter(Boolean).join(",");
    worksQuery = worksQuery.or(`and(${salePrice}),and(${regularPrice})`);
  }
  if (params.sale === "1") worksQuery = worksQuery.gt("sale_price", 0);
  if (params.sample === "1") worksQuery = worksQuery.not("sample_movie_url", "is", null).neq("sample_movie_url", "");
  const sort = params.sort === "date_desc" ? "release-desc" : params.sort === "date_asc" ? "release-asc" : params.sort;
  if (sort === "price") worksQuery = worksQuery.order("sale_price", { ascending: true, nullsFirst: false }).order("price", { ascending: true });
  else if (sort === "review") worksQuery = worksQuery.order("review_average", { ascending: false }).order("review_count", { ascending: false });
  else if (sort === "release-asc") worksQuery = worksQuery.order("release_date", { ascending: true, nullsFirst: false });
  else if (sort === "release-desc") worksQuery = worksQuery.order("release_date", { ascending: false, nullsFirst: false });
  else worksQuery = worksQuery.order("score", { ascending: false, nullsFirst: false });

  const response = await worksQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return { works: (response.data ?? []) as unknown as Work[], totalCount: response.count ?? 0, page, error: response.error };
}

async function getDiscoveryWorks() {
  const response = await supabase
    .from("works")
    .select("id,product_id,title,image_url,score,price,sale_price,list_price,discount_rate,actress,maker,series,genre,sample_movie_url,review_average,review_count,sale_end_at,affiliate_url")
    .order("score", { ascending: false, nullsFirst: false })
    .limit(8);

  return (response.data ?? []) as unknown as Work[];
}

async function getSearchPriceInsights(works: Work[]) {
  if (!works.length) return [] as HomePriceInsightWork[];
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  try {
    return await Promise.race([
      buildInsightsForWorks(works as unknown as HomePriceInsightWork[], since, { requireBuyTimingSignal: false }),
      new Promise<HomePriceInsightWork[]>((resolve) => setTimeout(() => resolve([]), 10_000)),
    ]);
  } catch {
    return [] as HomePriceInsightWork[];
  }
}

function splitValues(value: string | null) {
  return value?.split(" / ").map((item) => item.trim()).filter(Boolean) ?? [];
}

function buildSearchHref(params: SearchParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value) query.set(key, value);
  }
  query.set("page", String(page));
  return `/search?${query.toString()}`;
}

function WorkCard({ work }: { work: Work }) {
  return <FanzaStyleWorkCard work={work} sourcePage="search" />;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const releaseFrom = params.releaseFrom ?? params.dateStart;
  const releaseTo = params.releaseTo ?? params.dateEnd;
  const hasSearchConditions = Boolean(query || params.genres || releaseFrom || releaseTo || params.minPrice || params.maxPrice || params.sale === "1" || params.sample === "1" || params.sort);
  const { works, totalCount, page, error } = await searchWorks(query, params);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const searchInsights = await getSearchPriceInsights(works);
  const searchInsightsById = new Map(searchInsights.map((work) => [work.id, work]));
  const discoveryWorks = !hasSearchConditions || (!error && works.length === 0) ? await getDiscoveryWorks() : [];
  const suggestions = Array.from(
    new Set(
      discoveryWorks.flatMap((work) => [
        ...splitValues(work.actress).slice(0, 1),
        ...splitValues(work.genre).slice(0, 1),
        work.maker,
      ]).filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 8);

  return (
    <>
      <Header />
      <main className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950">
        {hasSearchConditions ? (
          <section className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div>
                <h1 className="mt-2 flex items-baseline gap-3 text-2xl font-black tracking-tight sm:text-3xl">検索結果 <span className="text-sm font-bold text-slate-500 sm:text-base">{totalCount}件</span></h1>
              </div>
              <form action="/search" className="flex items-center gap-3">
                <input type="hidden" name="q" value={query} />
                {params.genres && <input type="hidden" name="genres" value={params.genres} />}
                {releaseFrom && <input type="hidden" name="releaseFrom" value={releaseFrom} />}
                {releaseTo && <input type="hidden" name="releaseTo" value={releaseTo} />}
                {params.minPrice && <input type="hidden" name="minPrice" value={params.minPrice} />}
                {params.maxPrice && <input type="hidden" name="maxPrice" value={params.maxPrice} />}
                {params.sale === "1" && <input type="hidden" name="sale" value="1" />}
                {params.sample === "1" && <input type="hidden" name="sample" value="1" />}
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600">並び順<select name="sort" defaultValue={params.sort ?? "score"} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800"><option value="score">発掘スコア順</option><option value="release-desc">発売日が新しい順</option><option value="release-asc">発売日が古い順</option><option value="price">価格が安い順</option><option value="review">レビュー評価順</option></select></label>
                <button type="submit" className="h-10 rounded-lg bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-pink-600">適用</button>
              </form>
            </div>
          </section>
        ) : (
          <section className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
              <Link href="/" className="text-xs font-bold text-slate-500 transition hover:text-pink-600">TOP <span className="mx-1">/</span> 検索</Link>
              <div className="mt-5 flex max-w-3xl items-start gap-4">
                <span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><Search size={28} /></span>
                <div className="min-w-0"><p className="text-xs font-black tracking-[0.18em] text-pink-600">SEARCH</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">作品を検索</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">作品名・品番を中心に、女優・メーカー・シリーズ・ジャンルから発掘できます。</p></div>
              </div>
              <form action="/search" className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
                <label className="flex min-w-0 flex-1 items-center rounded-2xl border border-slate-300 bg-white px-4 shadow-sm focus-within:border-pink-400 focus-within:ring-4 focus-within:ring-pink-50"><Search size={19} className="shrink-0 text-slate-400" /><input type="search" name="q" maxLength={MAX_QUERY_LENGTH} aria-label="検索語" autoComplete="off" placeholder="作品名・品番・女優・メーカーなど" className="h-14 min-w-0 flex-1 bg-transparent pl-3 text-base outline-none placeholder:text-slate-400" /></label>
                <button type="submit" className="h-14 shrink-0 rounded-2xl bg-slate-950 px-8 text-sm font-black text-white shadow-sm transition hover:bg-pink-600">検索する</button>
              </form>
              {suggestions.length > 0 && <div className="mt-4 flex max-w-4xl flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-500">人気の候補</span>{suggestions.map((suggestion) => <Link key={suggestion} href={`/search?q=${encodeURIComponent(suggestion)}`} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-pink-300 hover:text-pink-600">{suggestion}</Link>)}</div>}
            </div>
          </section>
        )}

        <div className={`mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8 ${hasSearchConditions ? "py-6 lg:py-8" : "py-10 lg:py-14"}`}>
          {!hasSearchConditions ? (
            <><div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-10"><Search className="mx-auto text-slate-300" size={40} /><p className="mt-4 font-black">検索語を入力してください</p><p className="mt-2 text-sm leading-6 text-slate-500">候補をクリックするか、特集・お得ページから条件を絞れます。</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/features" className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">特集から探す</Link><Link href="/deals" className="rounded-full bg-pink-50 px-4 py-2 text-sm font-black text-pink-700">お得条件から探す</Link></div></div><section className="mt-10"><p className="text-xs font-black tracking-widest text-pink-600">DISCOVERY</p><h2 className="mt-1 text-2xl font-black">迷ったときの高スコア作品</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{discoveryWorks.map((work) => <WorkCard key={work.id} work={work} />)}</div></section></>
          ) : error ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black">検索結果を読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div>
          ) : works.length === 0 ? (
            <><div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-14"><Sparkles className="mx-auto text-slate-300" size={40} /><p className="mt-4 break-all font-black">「{query}」に一致する作品はありませんでした</p><p className="mt-2 text-sm leading-6 text-slate-500">検索語を短くするか、上の候補をお試しください。</p></div><section className="mt-10"><h2 className="text-2xl font-black">代わりに人気作品を見る</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{discoveryWorks.map((work) => <WorkCard key={work.id} work={work} />)}</div></section></>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{works.map((work) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="search" insight={searchInsightsById.get(work.id)} />)}</div>
              {totalPages > 1 && <nav aria-label="検索結果のページ" className="mt-10 flex items-center justify-center gap-3">
                {page > 1 ? <Link href={buildSearchHref(params, page - 1)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-pink-300 hover:text-pink-600">前へ</Link> : <span className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-black text-slate-400">前へ</span>}
                <span className="text-sm font-bold text-slate-500">{page} / {totalPages}</span>
                {page < totalPages ? <Link href={buildSearchHref(params, page + 1)} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-600">次へ</Link> : <span className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-400">次へ</span>}
              </nav>}
            </>
          )}
        </div>
      </main>
    </>
  );
}
