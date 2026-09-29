import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Ruler, Shapes } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";
import { getEntityIndexSummary, isEntityIndexable } from "@/lib/catalog/entityIndexSummaries";
import { ENTITY_PAGE_SIZE, getActressContext, getActressWorksPage } from "@/lib/catalog/entityWorks";
import { getActressProfiles } from "@/lib/catalog/actressProfiles";
import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";

export const revalidate = 86400;

export async function actressMetadata(actressName: string, page = 1): Promise<Metadata> {
  let robots: Metadata["robots"] = { index: false, follow: true };
  try {
    const summary = await getEntityIndexSummary("actress", actressName);
    const pageResult = page === 1 ? await getActressWorksPage(actressName, 1) : null;
    if (page === 1 && summary && isEntityIndexable("actress", summary) && pageResult && !pageResult.error && pageResult.works.length > 0) robots = undefined;
  } catch {
    // Keep thin or unavailable pages out of search indexes.
  }
  return pageMetadata({ title: `${actressName}の出演作品・プロフィール${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`, description: `${actressName}の出演作品とプロフィールを確認できます。`, canonical: `/actress/${encodeURIComponent(actressName)}${page > 1 ? `/page/${page}` : ""}`, robots });
}

function releaseDate(value: string | null) { return value ? new Date(value).getTime() || 0 : 0; }
function priceOf(work: Work) { return work.sale_price > 0 ? work.sale_price : work.price; }
function costPerformanceScore(work: Work) {
  const reviewAverage = Math.min(Math.max(work.review_average ?? 0, 0), 5) / 5;
  const reviewConfidence = Math.min(Math.log10(Math.max(work.review_count ?? 0, 0) + 1) / 2.5, 1);
  const quality = Math.min(Math.max(work.score ?? 0, 0), 100) / 100;
  const discount = Math.min(Math.max(work.discount_rate ?? 0, 0), 100) / 100;
  const pricePenalty = Math.min(priceOf(work) / 5000, 1);
  return quality * 0.45 + reviewAverage * 0.25 + reviewConfidence * 0.15 + discount * 0.15 - pricePenalty * 0.12;
}

export async function ActressDetailPage({ actressName, currentPage }: { actressName: string; currentPage: number }) {
  const [summary, pageResult, contextResult, profiles] = await Promise.all([
    getEntityIndexSummary("actress", actressName).catch(() => null),
    getActressWorksPage(actressName, currentPage),
    getActressContext(actressName),
    getActressProfiles([actressName]),
  ]);
  const works = [...pageResult.works as Work[]].sort(
    (a, b) => releaseDate(b.release_date ?? b.product_release_date) - releaseDate(a.release_date ?? a.product_release_date) || b.id - a.id,
  );
  if (!pageResult.error && works.length === 0) notFound();
  const profile = profiles.find((item) => item.name === actressName) ?? profiles[0];
  const contextWorks = contextResult.works as Work[];
  const totalCount = summary?.count ?? ((currentPage - 1) * ENTITY_PAGE_SIZE + works.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / ENTITY_PAGE_SIZE));
  const topWork = works[0] ?? contextWorks[0];
  const highCostWorks = [...contextWorks]
    .filter((work) => priceOf(work) > 0)
    .sort((a, b) => costPerformanceScore(b) - costPerformanceScore(a) || (b.review_average ?? 0) - (a.review_average ?? 0) || (b.review_count ?? 0) - (a.review_count ?? 0) || b.id - a.id)
    .slice(0, 6);
  const newestWorks = [...contextWorks]
    .sort((a, b) => releaseDate(b.release_date ?? b.product_release_date) - releaseDate(a.release_date ?? a.product_release_date) || b.id - a.id)
    .slice(0, 4);
  const insightCandidates = [...new Map([...highCostWorks, ...works].map((work) => [work.id, work])).values()];
  const priceInsights = await buildInsightsForWorks(
    insightCandidates as unknown as HomePriceInsightWork[],
    new Date(new Date().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    { requireBuyTimingSignal: false },
  ).catch(() => []);
  const priceInsightsByWorkId = new Map(priceInsights.map((insight) => [insight.id, insight]));
  const profileImage = profile?.image_url_large || profile?.image_url_small || null;
  const pageHref = (targetPage: number) => targetPage > 1 ? `/actress/${encodeURIComponent(actressName)}/page/${targetPage}` : `/actress/${encodeURIComponent(actressName)}`;
  const topWorkGridClass = "grid max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
  const latestWorkGridClass = "grid max-w-[1500px] grid-cols-2 gap-3 lg:grid-cols-4";

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
    <Link href="/actress" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-pink-600"><ArrowLeft size={15} /> 女優一覧に戻る</Link>
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-pink-600 bg-slate-100 sm:h-32 sm:w-32"><WorkImage src={profileImage || topWork?.image_url} fallbackSrc={profileImage ? topWork?.image_url : null} alt={`${actressName}のプロフィール写真`} sizes="128px" unoptimized className="object-cover" /></div><div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-3 sm:items-center"><div><h1 className="text-3xl font-black sm:text-4xl">{actressName}</h1>{profile?.ruby && <p className="mt-1 text-sm text-slate-500">{profile.ruby}</p>}</div><div className="space-y-2 text-sm"><p className="flex items-center gap-2 text-slate-500"><CalendarDays size={15} /> 生年月日 <strong className="text-slate-800">{profile?.birthday ?? "未取得"}</strong></p><p className="flex items-center gap-2 text-slate-500"><Ruler size={15} /> 身長 <strong className="text-slate-800">{profile?.height_cm ? `${profile.height_cm} cm` : "未取得"}</strong></p></div><p className="flex items-center gap-2 text-sm text-slate-500"><Shapes size={15} /> スリーサイズ <strong className="text-slate-800">{profile?.bust_cm || profile?.waist_cm || profile?.hip_cm ? `B${profile.bust_cm ?? "-"} / W${profile.waist_cm ?? "-"} / H${profile.hip_cm ?? "-"}` : "未取得"}</strong></p></div></div></section>
    {highCostWorks.length > 0 && <section className="mt-8"><SectionTitle title="高コスパ作品" count={highCostWorks.length} color="amber" /><div className={topWorkGridClass}>{highCostWorks.map((work) => <FanzaStyleWorkCard key={`cost-${work.id}`} work={work} sourcePage="direct" insight={priceInsightsByWorkId.get(work.id)} />)}</div></section>}
    {newestWorks.length > 0 && <section className="mt-10"><SectionTitle title="最新作" count={newestWorks.length} color="pink" /><div className={latestWorkGridClass}>{newestWorks.map((work) => <FanzaStyleWorkCard key={`new-${work.id}`} work={work} sourcePage="direct" showChart={false} />)}</div></section>}
    {pageResult.error ? <div className="mt-10 rounded-lg border border-red-200 bg-white p-10 text-center font-black">作品を読み込めませんでした</div> : works.length > 0 && <section className="mt-10"><SectionTitle title="出演作品一覧" count={totalCount} color="pink" /><div className={topWorkGridClass}>{works.map((work) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="direct" insight={priceInsightsByWorkId.get(work.id)} />)}</div>{totalPages > 1 && <nav aria-label={`${actressName}の出演作品一覧のページ送り`} className="mt-8 flex items-center justify-center gap-3"><span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次のページ →</Link>}</nav>}</section>}
  </div></main></>;
}

function SectionTitle({ title, count, color }: { title: string; count?: number; color: "amber" | "pink" }) { return <div className="mb-4 flex items-center gap-3"><span className={`h-7 w-1 rounded-full ${color === "amber" ? "bg-amber-400" : "bg-pink-500"}`} /><h2 className="text-xl font-black">{title}</h2>{count != null && <span className="text-xs font-bold text-zinc-500">({count}件)</span>}</div>; }
