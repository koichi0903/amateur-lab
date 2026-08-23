import Header from "@/components/layout/Header";
import Hero from "@/components/home/hero/Hero";
import InsightFeed from "@/components/home/insight/InsightFeed";
import RankingSection from "@/components/home/ranking/RankingSection";
import {
  CategorySection,
  SaleSection,
  StatStrip,
} from "@/components/home/HomeSections";
import PriceInsightSections from "@/components/home/PriceInsightSections";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { getDailyDiscovery } from "@/lib/getDailyDiscovery";
import { getHomePriceInsights } from "@/lib/getHomePriceInsights";

export const revalidate = 1800;

export default async function Home() {
  const now = new Date();
  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const todayStart = new Date(`${jstDate}T00:00:00+09:00`);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [statisticsResult, totalWorksResult, todayUpdatesResult, saleWorksResult, totalInsightsResult, dailyDiscovery, rankingResult, saleResult, insightsResult, priceInsights] =
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
        .eq("is_on_sale", true),
      supabase.from("insights").select("id", { count: "exact", head: true }),
      getDailyDiscovery(jstDate),
      supabase
        .from("works")
        .select("id,title,image_url,score,price,sale_price,list_price,discount_rate")
        .order("score", { ascending: false })
        .limit(10),
      supabase
        .from("works")
        .select("id,title,image_url,price,sale_price,discount_rate")
        .eq("is_on_sale", true)
        .order("discount_rate", { ascending: false })
        .limit(5),
      supabase
        .from("insights")
        .select("id,type,title,description,works(id,title,image_url,score,review_average)")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      getHomePriceInsights(),
    ]);

  const statistics = statisticsResult.data;
  const featuredWork = dailyDiscovery.work ?? rankingResult.data?.[0] ?? null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Hero work={featuredWork} eyebrow={dailyDiscovery.eyebrow} reason={dailyDiscovery.reason} priceInsight={priceInsights.buyTiming[0] ?? null} />
        <StatStrip
          totalWorks={totalWorksResult.count ?? statistics?.total_works ?? 0}
          todayUpdates={todayUpdatesResult.count ?? 0}
          saleWorks={saleWorksResult.count ?? 0}
          aiInsights={totalInsightsResult.count ?? 0}
        />
        <InsightFeed insights={insightsResult.data ?? []} />
        <PriceInsightSections
          priceDrops={priceInsights.priceDrops}
          lowestUpdates={priceInsights.lowestUpdates}
          buyTiming={priceInsights.buyTiming}
        />
        <RankingSection works={(rankingResult.data ?? []) as Work[]} />
        <SaleSection works={(saleResult.data ?? []) as Work[]} />
        <CategorySection />
      </main>
    </>
  );
}
