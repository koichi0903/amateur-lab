import Header from "@/components/layout/Header";
import Hero from "@/components/home/hero/Hero";
import InsightFeed from "@/components/home/insight/InsightFeed";
import RankingSection from "@/components/home/ranking/RankingSection";
import {
  CategorySection,
  SaleSection,
  StatStrip,
} from "@/components/home/HomeSections";
import { supabase } from "@/lib/supabase";

export const revalidate = 300;

export default async function Home() {
  const now = new Date();
  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const todayStart = new Date(`${jstDate}T00:00:00+09:00`);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [statisticsResult, totalWorksResult, todayUpdatesResult, saleWorksResult, totalInsightsResult, featuredResult, rankingResult, saleResult, insightsResult] =
    await Promise.all([
      supabase.from("site_statistics").select("*").eq("id", 1).maybeSingle(),
      supabase.from("works").select("*", { count: "exact", head: true }),
      supabase
        .from("works")
        .select("*", { count: "exact", head: true })
        .gte("updated_at", todayStart.toISOString())
        .lt("updated_at", tomorrowStart.toISOString()),
      supabase
        .from("works")
        .select("*", { count: "exact", head: true })
        .eq("is_on_sale", true),
      supabase.from("insights").select("*", { count: "exact", head: true }),
      supabase
        .from("works")
        .select("*")
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("works")
        .select("*")
        .order("score", { ascending: false })
        .limit(10),
      supabase
        .from("works")
        .select("*")
        .eq("is_on_sale", true)
        .order("discount_rate", { ascending: false })
        .limit(5),
      supabase
        .from("insights")
        .select("*, works (*)")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const statistics = statisticsResult.data;
  const featuredWork = featuredResult.data ?? rankingResult.data?.[0] ?? null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Hero work={featuredWork} />
        <StatStrip
          totalWorks={totalWorksResult.count ?? statistics?.total_works ?? 0}
          todayUpdates={todayUpdatesResult.count ?? 0}
          saleWorks={saleWorksResult.count ?? 0}
          aiInsights={totalInsightsResult.count ?? 0}
        />
        <InsightFeed insights={insightsResult.data ?? []} />
        <RankingSection works={rankingResult.data ?? []} />
        <SaleSection works={saleResult.data ?? []} />
        <CategorySection />
      </main>
    </>
  );
}
