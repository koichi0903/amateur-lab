import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AmateurActressDetailPageView from "@/components/catalog/AmateurActressDetailPageView";
import { getFanzaAmateurActressIndex, getFanzaAmateurActressWorks } from "@/lib/dmm/fanzaAmateurCatalog";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const AMATEUR_ACTRESS_PAGE_SIZE = 60;

async function getActressSummary(actressName: string) {
  const result = await getFanzaAmateurActressIndex({ query: actressName, sort: "count-desc", page: 1 });
  return result.items.find((item) => item.name === actressName) ?? null;
}

export async function amateurActressMetadata(actressName: string, page = 1): Promise<Metadata> {
  const summary = await getActressSummary(actressName).catch(() => null);
  if (!summary) return pageMetadata({ title: `${actressName}の素人出演作品 | 発掘LAB`, description: `${actressName}が出演するFANZA素人作品一覧です。`, canonical: `/amateur/actress/${encodeURIComponent(actressName)}`, robots: { index: false, follow: true } });
  const totalCount = Number(summary.work_count);
  const description = `${actressName}の出演が確認されたFANZA素人作品${totalCount.toLocaleString("ja-JP")}件。プロフィール、最新作、価格履歴をまとめています。履歴がある作品は価格推移チャートで確認できます。`;
  return pageMetadata({
    title: `${actressName}の素人出演作品・プロフィール${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description,
    canonical: `/amateur/actress/${encodeURIComponent(actressName)}${page > 1 ? `/page/${page}` : ""}`,
    robots: page > 1 ? { index: false, follow: true } : undefined,
  });
}

function priceOf(card: Awaited<ReturnType<typeof getFanzaAmateurActressWorks>>["cards"][number]) {
  return card.item.currentPrice ?? Number(card.item.prices?.list_price?.match(/[0-9]+/)?.[0] ?? 0);
}

function costPerformanceScore(card: Awaited<ReturnType<typeof getFanzaAmateurActressWorks>>["cards"][number]) {
  const item = card.item;
  const reviewAverage = Math.min(Math.max(item.reviewAverage ?? 0, 0), 5) / 5;
  const reviewConfidence = Math.min(Math.log10(Math.max(item.review?.count ?? 0, 0) + 1) / 2.5, 1);
  const listPrice = Number(item.prices?.list_price?.match(/[0-9]+/)?.[0] ?? 0);
  const discount = listPrice > 0 && item.currentPrice != null ? Math.min(Math.max((listPrice - item.currentPrice) / listPrice, 0), 1) : 0;
  const pricePenalty = Math.min(priceOf(card) / 5000, 1);
  return reviewAverage * 0.4 + reviewConfidence * 0.35 + discount * 0.25 - pricePenalty * 0.12;
}

export async function AmateurActressDetailPage({ actressName, currentPage }: { actressName: string; currentPage: number }) {
  const summary = await getActressSummary(actressName);
  if (!summary || summary.work_count < 1) notFound();
  const totalCount = Number(summary.work_count);
  const totalPages = Math.max(1, Math.ceil(totalCount / AMATEUR_ACTRESS_PAGE_SIZE));
  if (currentPage < 1 || currentPage > totalPages) notFound();
  const safeCurrentPage = currentPage;
  const [pageResult, contextResult, newestResult] = await Promise.all([
    getFanzaAmateurActressWorks({ name: actressName, page: safeCurrentPage, pageSize: AMATEUR_ACTRESS_PAGE_SIZE, sort: "newest" }),
    getFanzaAmateurActressWorks({ name: actressName, page: 1, pageSize: 300, sort: "review" }),
    getFanzaAmateurActressWorks({ name: actressName, page: 1, pageSize: 4, sort: "newest" }),
  ]);

  const currentCards = pageResult.cards;
  const contextCards = contextResult.cards;
  const highCostWorks = [...contextCards]
    .filter((card) => priceOf(card) > 0)
    .sort((a, b) => costPerformanceScore(b) - costPerformanceScore(a) || (b.item.reviewAverage ?? 0) - (a.item.reviewAverage ?? 0) || (b.item.review?.count ?? 0) - (a.item.review?.count ?? 0))
    .slice(0, 6);
  const newestWorks = newestResult.cards.slice(0, 4);
  const pageHref = (targetPage: number) => targetPage > 1
    ? `/amateur/actress/${encodeURIComponent(actressName)}/page/${targetPage}`
    : `/amateur/actress/${encodeURIComponent(actressName)}`;
  const profileImage = summary.profile_image_url || summary.image_url;
  const pageDescription = `${actressName}の出演が確認されたFANZA素人作品${totalCount.toLocaleString("ja-JP")}件。作品ごとの価格情報と、履歴がある作品の価格推移チャートを掲載しています。`;
  const canonicalUrl = `${SITE_URL}${pageHref(safeCurrentPage)}`;

  return (
    <AmateurActressDetailPageView
      actressName={actressName}
      currentPage={safeCurrentPage}
      totalCount={totalCount}
      totalPages={totalPages}
      summary={summary}
      profileImage={profileImage}
      currentCards={currentCards}
      highCostWorks={highCostWorks}
      newestWorks={newestWorks}
      pageDescription={pageDescription}
      canonicalUrl={canonicalUrl}
      pageHref={pageHref}
    />
  );
}

