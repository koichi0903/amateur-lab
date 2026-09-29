import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Crown, Sparkles, Trophy } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import { getDiscoveryEntityRankings, type DiscoveryEntityKind, type DiscoveryEntityRankingItem } from "@/lib/ranking/discoveryEntityRanking";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";
import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import { sortTrendingWorks } from "@/lib/trendingRanking";

export const revalidate = 86400;

const rankingTypes = {
  overall: { label: "総合", title: "FANZA人気作品ランキング", description: "FANZAで注目されている作品を、価格・レビュー・販売状況とあわせて比較できます。" },
  actress: { label: "女優", title: "FANZA作品から見る発掘女優ランキング", description: "FANZA出演作品の発掘スコアと実績を集計し、いま発掘したい女優を紹介します。", entityLabel: "女優" },
  genre: { label: "ジャンル", title: "FANZA作品の発掘ジャンルランキング", description: "FANZA所属作品の発掘スコアと実績を集計し、いま発掘したいジャンルを紹介します。", entityLabel: "ジャンル" },
  maker: { label: "メーカー", title: "FANZA作品の発掘メーカーランキング", description: "FANZA所属作品の発掘スコアと実績を集計し、いま発掘したいメーカーを紹介します。", entityLabel: "メーカー" },
} as const;

type RankingType = keyof typeof rankingTypes;

type RankingParams = { type?: string; page?: string; sale?: string; sample?: string; maxPrice?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<RankingParams> }): Promise<Metadata> {
  const params = await searchParams;
  const type: RankingType = params.type && params.type in rankingTypes ? params.type as RankingType : "overall";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1;
  const query = new URLSearchParams();
  if (type !== "overall") query.set("type", type);
  if (page > 1) query.set("page", String(page));
  return pageMetadata({
    title: `${rankingTypes[type].title}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: rankingTypes[type].description,
    canonical: query.size ? `/ranking?${query}` : "/ranking",
    robots: params.sale || params.sample || params.maxPrice ? { index: false, follow: true } : undefined,
  });
}

function RankBadge({ rank }: { rank: number }) {
  const styles = [
    "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-amber-200",
    "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-200",
    "bg-gradient-to-br from-orange-400 to-orange-700 text-white shadow-orange-200",
  ];
  return <span className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-black shadow-lg ${styles[rank - 1] ?? "bg-slate-900 text-white"}`}>{rank}</span>;
}

function WorkListCard({ work, rank, insight }: { work: Work; rank: number; insight?: HomePriceInsightWork }) {
  return <FanzaStyleWorkCard work={work} sourcePage="ranking" rank={rank} insight={insight} />;
}

function EntityMetrics({ item, compact = false }: { item: DiscoveryEntityRankingItem; compact?: boolean }) {
  return <div className={`grid grid-cols-3 gap-2 ${compact ? "mt-2" : "mt-4 border-t border-slate-100 pt-4"}`}><div><p className="text-[10px] font-bold leading-4 text-slate-400">{compact ? "上位5平均" : "上位5作品平均"}</p><p className={`${compact ? "text-sm" : "text-lg"} font-black text-slate-700`}>{item.topWorkAverage}</p></div><div><p className="text-[10px] font-bold leading-4 text-slate-400">{compact ? "上位20平均" : "上位20作品平均"}</p><p className={`${compact ? "text-sm" : "text-lg"} font-black text-slate-700`}>{item.strongWorkAverage}</p></div><div><p className="text-[10px] font-bold leading-4 text-slate-400">{compact ? "登録数" : "登録作品数"}</p><p className={`${compact ? "text-sm" : "text-lg"} whitespace-nowrap font-black text-slate-700`}>{item.workCount}作品</p></div></div>;
}

function EntityTopCard({ item, kind }: { item: DiscoveryEntityRankingItem; kind: DiscoveryEntityKind }) {
  return <Link href={`/${kind}/${encodeURIComponent(item.name)}`} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:p-4 ${item.rank === 1 ? "border-amber-300 lg:-mt-4 lg:mb-4" : "border-slate-200"}`}><div className="absolute left-5 top-5 z-10"><RankBadge rank={item.rank} /></div>{item.rank === 1 && <Crown className="absolute right-5 top-5 z-10 text-amber-500" size={27} />}<div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100"><WorkImage src={item.imageUrl} alt={`${item.name}の代表作品`} sizes="(max-width: 768px) 92vw, 30vw" priority={item.rank === 1} unoptimized className="object-cover transition duration-500 group-hover:scale-105" /></div><div className="flex flex-1 flex-col px-1 pb-1 pt-4"><div className="text-pink-600"><span className="block text-[10px] font-black tracking-wider">発掘{rankingTypes[kind].entityLabel}スコア</span><strong className="mt-1 block text-3xl leading-none">{item.discoveryScore}<span className="ml-1 text-xs">/ 100</span></strong></div><h2 className="mt-3 line-clamp-2 min-h-12 text-base font-black leading-6 text-slate-900">{item.name}</h2><EntityMetrics item={item} /><span className="mt-3 flex items-center justify-end gap-1 text-sm font-black text-pink-600">作品を見る <ArrowRight size={15} /></span></div></Link>;
}

function EntityListCard({ item, kind }: { item: DiscoveryEntityRankingItem; kind: DiscoveryEntityKind }) {
  return <Link href={`/${kind}/${encodeURIComponent(item.name)}`} className="group grid min-w-0 grid-cols-[38px_112px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-pink-200 hover:shadow-md sm:grid-cols-[48px_150px_minmax(0,1fr)] sm:gap-5 sm:p-4"><span className="text-center text-xl font-black text-slate-400 sm:text-2xl">{item.rank}</span><div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={item.imageUrl} alt={`${item.name}の代表作品`} sizes="150px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" /></div><div className="min-w-0"><p className="text-[10px] font-black tracking-wider text-pink-600">発掘{rankingTypes[kind].entityLabel}スコア</p><p className="text-2xl font-black leading-none text-pink-600">{item.discoveryScore}<span className="ml-1 text-[10px]">/ 100</span></p><h2 className="mt-2 line-clamp-2 break-all text-sm font-black leading-5 sm:text-base">{item.name}</h2><EntityMetrics item={item} compact /></div></Link>;
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<RankingParams> }) {
  const params = await searchParams;
  const type: RankingType = params.type && params.type in rankingTypes ? params.type as RankingType : "overall";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 30;
  const offset = (page - 1) * pageSize;
  const current = rankingTypes[type];
  const saleOnly = params.sale === "1";
  const sampleOnly = params.sample === "1";
  const maxPrice = Number(params.maxPrice) > 0 ? Number(params.maxPrice) : null;

  let works: Work[] = [];
  let entities: DiscoveryEntityRankingItem[] = [];
  let errorMessage: string | null = null;
  let totalItems = 0;

  if (type === "overall") {
    let rankingQuery = supabase.from("works").select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,sample_movie_url,lowest_price,is_bottom_price,sale_end_at,ranking,realtime_rank,previous_realtime_rank,review_average,review_count,affiliate_url", { count: "exact" }).or(NON_VR_GENRE_OR_FILTER).not("title", "ilike", "%VR%");
    if (saleOnly) rankingQuery = rankingQuery.gt("sale_price", 0);
    if (sampleOnly) rankingQuery = rankingQuery.not("sample_movie_url", "is", null).neq("sample_movie_url", "");
    if (maxPrice) rankingQuery = rankingQuery.or(`and(sale_price.gt.0,sale_price.lte.${maxPrice}),and(sale_price.eq.0,price.lte.${maxPrice})`);
    const result = await rankingQuery.limit(2000);
    const sortedWorks = sortTrendingWorks(((result.data ?? []) as unknown as Work[]).filter(isNonVrWork));
    works = sortedWorks.slice(offset, offset + pageSize);
    totalItems = result.count ?? works.length;
    errorMessage = result.error?.message ?? null;
  } else {
    try {
      const allEntities = await getDiscoveryEntityRankings(type);
      totalItems = allEntities.length;
      entities = allEntities.slice(offset, offset + pageSize);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "ランキングの集計に失敗しました";
    }
  }

  const itemCount = type === "overall" ? works.length : entities.length;
  let rankingInsights: HomePriceInsightWork[] = [];
  if (type === "overall" && works.length) {
    try {
      rankingInsights = await buildInsightsForWorks(
        works as unknown as HomePriceInsightWork[],
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        { requireBuyTimingSignal: false },
      );
    } catch (error) {
      console.warn("[ranking] price histories are temporarily unavailable", error);
    }
  }
  const rankingInsightsById = new Map(rankingInsights.map((insight) => [insight.id, insight]));
  const hasNextPage = offset + itemCount < totalItems;
  const pageHref = (targetPage: number) => { const query = new URLSearchParams(); if (type !== "overall") query.set("type", type); if (targetPage > 1) query.set("page", String(targetPage)); if (saleOnly) query.set("sale", "1"); if (sampleOnly) query.set("sample", "1"); if (maxPrice) query.set("maxPrice", String(maxPrice)); return query.size ? `/ranking?${query}` : "/ranking"; };
  const entityKind = type === "overall" ? null : type;

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    {type === "overall" ? <section className="bg-white"><div className="mx-auto max-w-[1500px] px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8"><h1 className="text-3xl font-black tracking-tight sm:text-5xl">FANZA人気作品ランキング</h1><p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">現在の売れ筋作品をランキング順に掲載。価格・割引・レビュー情報とあわせて比較できます。</p><p className="mt-2 max-w-4xl text-xs leading-6 text-slate-500 sm:text-sm">FANZAの人気作品を定期的に集計し、上位作品を一覧で確認できます。気になる作品は詳細ページで現在価格やセール情報を確認できます。</p></div></section> : <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><Link href="/" className="text-xs font-bold text-slate-500 transition hover:text-pink-600">TOP <span className="mx-1">/</span> ランキング</Link><div className="mt-5 flex max-w-3xl items-start gap-4"><span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><Trophy size={28} /></span><div className="min-w-0"><p className="text-xs font-black tracking-[0.18em] text-pink-600">DISCOVERY RANKING</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{current.title}</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{current.description}</p></div></div><nav aria-label="ランキング種別" className="mt-8 flex gap-2 overflow-x-auto pb-1">{(Object.entries(rankingTypes) as [RankingType, (typeof rankingTypes)[RankingType]][]).map(([key, item]) => <Link key={key} href={key === "overall" ? "/ranking" : `/ranking?type=${key}`} aria-current={key === type ? "page" : undefined} className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black transition ${key === type ? "bg-slate-950 text-white shadow-md" : "border border-slate-200 bg-white text-slate-600 hover:border-pink-300 hover:text-pink-600"}`}>{item.label}</Link>)}</nav></div></section>}
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{errorMessage ? <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black">ランキングを読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div> : itemCount === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-black">ランキングを集計中です</p></div> : type === "overall" ? <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{works.map((work, index) => <WorkListCard key={work.id} work={work} rank={offset + index + 1} insight={rankingInsightsById.get(work.id)} />)}</div>{(page > 1 || hasNextPage) && <nav aria-label="ランキングのページ送り" className="mt-10 flex items-center justify-center gap-3">{page > 1 && <Link href={pageHref(page - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前の30件</Link>}{hasNextPage && <Link href={pageHref(page + 1)} className="flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">次の30件 <ArrowRight size={16} /></Link>}</nav>}</> : <><section aria-labelledby="top-ranking"><div className="mb-6"><p className="text-xs font-black tracking-widest text-pink-600">TOP PICKS</p><h2 id="top-ranking" className="mt-1 text-2xl font-black">{`発掘${rankingTypes[entityKind!].entityLabel} TOP3`}</h2></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{page === 1 && entities.slice(0, 3).map((item) => <EntityTopCard key={item.name} item={item} kind={entityKind!} />)}</div></section><section className="mt-12" aria-labelledby="all-ranking"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-pink-600">DISCOVERY RANKING</p><h2 id="all-ranking" className="mt-1 text-2xl font-black">{page === 1 ? "4位以降" : `${offset + 1}〜${offset + itemCount}位`}</h2></div><span className="shrink-0 text-xs font-bold text-slate-400">全{totalItems}件</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{(page === 1 ? entities.slice(3) : entities).map((item) => <EntityListCard key={item.name} item={item} kind={entityKind!} />)}</div></section>{(page > 1 || hasNextPage) && <nav aria-label="ランキングのページ送り" className="mt-10 flex items-center justify-center gap-3">{page > 1 && <Link href={pageHref(page - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前の30件</Link>}{hasNextPage && <Link href={pageHref(page + 1)} className="flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">次の30件 <ArrowRight size={16} /></Link>}</nav>}</>}</div>
  </main></>;
}
