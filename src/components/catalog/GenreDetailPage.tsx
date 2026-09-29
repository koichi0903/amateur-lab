import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import GenreSortSelect from "@/components/catalog/GenreSortSelect";
import type { Work } from "@/types/work";
import { CATALOG_PAGE_SIZE, getCatalogWorksPage, type CatalogWorkKind, type GenreWorkSort } from "@/lib/catalog/entityWorks";
import { buildInsightsForWorkIds, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";

export const revalidate = 86400;

async function buildGenreInsights(works: Work[]) {
  return buildInsightsForWorkIds(works, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), { requireBuyTimingSignal: false }).catch(() => [] as HomePriceInsightWork[]);
}

export default async function GenreDetailPage({ genreName, currentPage, kind = "genre", sort = "popular" }: { genreName: string; currentPage: number; kind?: CatalogWorkKind; sort?: GenreWorkSort }) {
  const pageResult = await getCatalogWorksPage(kind, genreName, currentPage, sort);
  const works = pageResult.works as Work[];
  if (!pageResult.error && works.length === 0) notFound();
  const totalCount = pageResult.totalCount || ((currentPage - 1) * CATALOG_PAGE_SIZE + works.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / CATALOG_PAGE_SIZE));
  const priceInsights = await buildGenreInsights(works);
  const priceInsightsByWorkId = new Map(priceInsights.map((insight) => [insight.id, insight]));
  const pageHref = (targetPage: number) => {
    const path = targetPage > 1 ? `/${kind}/${encodeURIComponent(genreName)}/page/${targetPage}` : `/${kind}/${encodeURIComponent(genreName)}`;
    return sort === "popular" ? path : `${path}?sort=${sort}`;
  };

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black tracking-widest text-pink-600">{kind.toUpperCase()}</p><h1 className="mt-1 break-words text-3xl font-black">{genreName}</h1><p className="mt-2 text-sm text-slate-500">全{totalCount}作品</p></div>
      <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-slate-500" /><label htmlFor="genre-sort" className="text-sm font-bold text-slate-600">並び順</label><GenreSortSelect value={sort} basePath={`/${kind}/${encodeURIComponent(genreName)}`} /></div>
    </div>
    {pageResult.error ? <div className="mt-6 rounded-lg border border-red-200 bg-white p-10 text-center font-black">作品を読み込めませんでした</div> : works.length > 0 && <section className="mt-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{works.map((work) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="direct" insight={priceInsightsByWorkId.get(work.id)} />)}</div>{totalPages > 1 && <nav aria-label={`${genreName}の作品一覧のページ送り`} className="mt-6 flex items-center justify-center gap-3"><span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次のページ →</Link>}</nav>}</section>}
  </div></main></>;
}
