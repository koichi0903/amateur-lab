import Header from "@/components/layout/Header";
import Hero from "@/components/home/hero/Hero";
import InsightFeed from "@/components/home/insight/InsightFeed";
import RankingSection from "@/components/home/ranking/RankingSection";
import {
  CategorySection,
  RevenuePathSection,
  SaleSection,
  StatStrip,
} from "@/components/home/HomeSections";
import PriceInsightSections from "@/components/home/PriceInsightSections";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { getHeroPriceDrop, getHomePriceInsights } from "@/lib/getHomePriceInsights";
import { getLatestDailyUpdate } from "@/lib/getLatestDailyUpdate";
import { getHomeRanking } from "@/lib/getHomeRanking";
import { getAiDiscoveries } from "@/lib/getAiDiscoveries";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";

export const revalidate = 1800;

const EMPTY_PRICE_INSIGHTS: Awaited<ReturnType<typeof getHomePriceInsights>> = {
  priceDrops: [],
  lowestUpdates: [],
  buyTiming: [],
  all: [],
};

async function recoverHomeData<T>(
  label: string,
  request: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await request;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[home] ${label} is temporarily unavailable: ${message}`);
    return fallback;
  }
}

export default async function Home() {
  const now = new Date();
  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const todayStart = new Date(`${jstDate}T00:00:00+09:00`);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [statisticsResult, totalWorksResult, todayUpdatesResult, saleWorksResult, totalInsightsResult, latestDailyUpdate, rankingResult, saleResult, priceInsights, aiDiscoveries, heroPriceDrop] =
    await Promise.all([
      supabase.from("site_statistics").select("total_works").eq("id", 1).maybeSingle(),
      supabase.from("works").select("id", { count: "exact", head: true }),
      supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", todayStart.toISOString())
        .lt("updated_at", tomorrowStart.toISOString()),
      supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("is_on_sale", true)
        .or(NON_VR_GENRE_OR_FILTER),
      supabase.from("insights").select("id", { count: "exact", head: true }),
      recoverHomeData("latest daily update", getLatestDailyUpdate(), null),
      recoverHomeData("ranking", getHomeRanking(), []),
      supabase
        .from("works")
        .select("id,title,image_url,genre,price,sale_price,list_price,discount_rate,sale_end_at")
        .eq("is_on_sale", true)
        .or(NON_VR_GENRE_OR_FILTER)
        .not("title", "ilike", "%VR%")
        .order("discount_rate", { ascending: false })
        .limit(20),
      recoverHomeData("price insights", getHomePriceInsights(), EMPTY_PRICE_INSIGHTS),
      recoverHomeData("AI discoveries", getAiDiscoveries(), []),
      recoverHomeData("hero price drop", getHeroPriceDrop(), null),
    ]);

  const statistics = statisticsResult.data;
  const featuredWork = heroPriceDrop
    ? aiDiscoveries.find((work) => work.id === heroPriceDrop.id) ?? null
    : null;
  const heroPriceInsight = featuredWork ? heroPriceDrop : null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Hero work={featuredWork} eyebrow="TODAY'S PRICE DISCOVERY" reason={featuredWork?.reason} priceInsight={heroPriceInsight} />
        <StatStrip
          totalWorks={totalWorksResult.count ?? statistics?.total_works ?? 0}
          todayUpdates={todayUpdatesResult.count ?? 0}
          saleWorks={saleWorksResult.count ?? 0}
          aiInsights={totalInsightsResult.count ?? 0}
        />
        <InsightFeed insights={aiDiscoveries.slice(0, 5).map((work) => ({ id: work.id, type: work.reasonType, title: work.title, description: work.reason, works: work }))} lastUpdatedAt={latestDailyUpdate} />
        <PriceInsightSections
          priceDrops={priceInsights.priceDrops}
          lowestUpdates={priceInsights.lowestUpdates}
          buyTiming={priceInsights.buyTiming}
        />
        <RevenuePathSection />
        <RankingSection works={rankingResult as Work[]} />
        <SaleSection works={((saleResult.data ?? []) as Work[]).filter(isNonVrWork).slice(0, 5)} />
        <CategorySection />
      </main>
    </>
  );
}
