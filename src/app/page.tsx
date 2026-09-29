import Header from "@/components/layout/Header";
import type { Metadata } from "next";
import Hero from "@/components/home/hero/Hero";
import RankingSection from "@/components/home/ranking/RankingSection";
import { NewSection, SaleSection } from "@/components/home/HomeSections";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import { getHomeRanking } from "@/lib/getHomeRanking";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork, isVrWork } from "@/lib/vr";
import { sortTrendingWorks } from "@/lib/trendingRanking";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FANZA作品の買い時・過去最安値・価格比較 | 発掘LAB",
  description: "FANZA作品の現在価格、過去最安値、レビュー、セール終了時期を確認して、今買うべきか待つべきか判断できます。",
  canonical: "/",
});

export const revalidate = 1800;
// Home aggregates live catalog, ranking, and price data. Render it at runtime
// so a deployment build never depends on Supabase connectivity.
export const dynamic = "force-dynamic";

const HOME_DATA_TIMEOUT_MS = 10_000;

async function recoverHomeData<T>(
  label: string,
  request: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await Promise.race([
      request,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("request timed out")), HOME_DATA_TIMEOUT_MS)),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[home] ${label} is temporarily unavailable: ${message}`);
    return fallback;
  }
}

export default async function Home() {
  const now = new Date();
  const [rankingResult, saleResult, newResult, vrRankingResult] =
    await Promise.all([
      recoverHomeData("ranking", getHomeRanking(), []),
      recoverHomeData("sale", (async () => supabase
        .from("works")
        .select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,review_average,review_count,sale_end_at,affiliate_url")
        .eq("is_on_sale", true)
        .or(NON_VR_GENRE_OR_FILTER)
        .not("title", "ilike", "%VR%")
        .order("realtime_rank", { ascending: true, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false })
        .limit(20))(), { success: true, data: [], error: null, count: 0, status: 200, statusText: "OK" }),
      recoverHomeData("new", (async () => supabase
        .from("works")
        .select("id,product_id,title,image_url,actress,genre,maker,score,price,sale_price,list_price,discount_rate,review_average,review_count,release_date,sale_end_at,affiliate_url")
        .eq("stage", "NEW")
        .or(NON_VR_GENRE_OR_FILTER)
        .not("title", "ilike", "%VR%")
        .order("release_date", { ascending: false, nullsFirst: false })
        .limit(12))(), { success: true, data: [], error: null, count: 0, status: 200, statusText: "OK" }),
      recoverHomeData("vr ranking", (async () => supabase
        .from("works")
        .select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,review_average,review_count,ranking,realtime_rank,previous_realtime_rank,sale_end_at,affiliate_url")
        .or("genre.ilike.%VR%,title.ilike.%VR%,genre.ilike.%ＶＲ%,title.ilike.%ＶＲ%")
        .limit(2000))(), { success: true, data: [], error: null, count: 0, status: 200, statusText: "OK" }),
    ]);

  const rankingWorks = rankingResult as Work[];
  const saleWorks = ((saleResult.data ?? []) as Work[]).filter(isNonVrWork).slice(0, 12);
  const newWorks = ((newResult.data ?? []) as Work[]).filter(isNonVrWork).slice(0, 12);
  const vrWorks = sortTrendingWorks(((vrRankingResult.data ?? []) as Work[]).filter(isVrWork)).slice(0, 12);
  const topCardPriceInsights = await recoverHomeData(
    "catalog price histories",
    buildInsightsForWorks(
      [...new Map(
        [...rankingWorks, ...saleWorks, ...newWorks, ...vrWorks].map((work) => [work.id, work]),
      ).values()] as unknown as HomePriceInsightWork[],
      new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      { requireBuyTimingSignal: false },
    ),
    [],
  );
  const topCardPriceInsightsById = new Map(topCardPriceInsights.map((work) => [work.id, work]));
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Hero />
        <RankingSection works={rankingWorks} priceInsightsByWorkId={topCardPriceInsightsById} />
        <SaleSection works={saleWorks} priceInsightsByWorkId={topCardPriceInsightsById} />
        <NewSection works={newWorks} priceInsightsByWorkId={topCardPriceInsightsById} />
        <RankingSection works={vrWorks} priceInsightsByWorkId={topCardPriceInsightsById} title="VR人気ランキング" moreHref="/vr" eyebrow="VR × 人気 × レビュー" />
      </main>
    </>
  );
}

