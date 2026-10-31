import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ActressDetailPageView from "@/components/catalog/ActressDetailPageView";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";
import { getEntityIndexSummary, isEntityIndexable } from "@/lib/catalog/entityIndexSummaries";
import { ENTITY_PAGE_SIZE, getActressContext, getActressWorksPage } from "@/lib/catalog/entityWorks";
import { getActressProfiles } from "@/lib/catalog/actressProfiles";
import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";

export const revalidate = 43200;

export async function actressMetadata(actressName: string, page = 1): Promise<Metadata> {
  let robots: Metadata["robots"] = { index: false, follow: true };
  try {
    const summary = await getEntityIndexSummary("actress", actressName);
    const pageResult = page === 1 ? await getActressWorksPage(actressName, 1) : null;
    if (page === 1 && summary && isEntityIndexable("actress", summary) && pageResult && !pageResult.error && pageResult.works.length > 0) robots = undefined;
  } catch {
    // Keep thin or unavailable pages out of search indexes.
  }
  return pageMetadata({ title: `${actressName}の出演作品・プロフィール${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`, description: `${actressName}のプロフィール、高コスパ作品、最新作、出演作品一覧を掲載。作品ごとの価格やレビュー情報も確認できます。`, canonical: `/actress/${encodeURIComponent(actressName)}${page > 1 ? `/page/${page}` : ""}`, robots });
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
    getActressWorksPage(actressName, currentPage).catch(() => ({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "一時的に作品データを取得できません", details: "", hint: "" },
      works: [],
    })),
    getActressContext(actressName).catch(() => ({ error: null, works: [] })),
    getActressProfiles([actressName]).catch(() => []),
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
  const worksWithMultiDayPriceHistory = priceInsights.filter((insight) => {
    const observedDates = new Set(
      insight.priceHistory
        .filter((point) => !point.isCurrent)
        .map((point) => point.changedAt.slice(0, 10)),
    );
    return observedDates.size >= 2;
  }).length;
  const pageHref = (targetPage: number) => targetPage > 1 ? `/actress/${encodeURIComponent(actressName)}/page/${targetPage}` : `/actress/${encodeURIComponent(actressName)}`;
  return (
    <ActressDetailPageView
      actressName={actressName}
      currentPage={currentPage}
      hasPageError={Boolean(pageResult.error)}
      works={works}
      profile={profile}
      totalCount={totalCount}
      totalPages={totalPages}
      topWork={topWork}
      highCostWorks={highCostWorks}
      newestWorks={newestWorks}
      insightCandidatesCount={insightCandidates.length}
      priceInsightsByWorkId={priceInsightsByWorkId}
      worksWithMultiDayPriceHistory={worksWithMultiDayPriceHistory}
      pageHref={pageHref}
    />
  );
}
