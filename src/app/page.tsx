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
  const [statisticsResult, featuredResult, rankingResult, saleResult, insightsResult] =
    await Promise.all([
      supabase.from("site_statistics").select("*").eq("id", 1).maybeSingle(),
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
        .gt("discount_rate", 0)
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
          totalWorks={statistics?.total_works ?? 0}
          todayUpdates={statistics?.today_updates ?? insightsResult.data?.length ?? 0}
          saleWorks={statistics?.sale_works ?? saleResult.data?.length ?? 0}
          aiInsights={statistics?.total_insights ?? insightsResult.data?.length ?? 0}
        />
        <InsightFeed insights={insightsResult.data ?? []} />
        <RankingSection works={rankingResult.data ?? []} />
        <SaleSection works={saleResult.data ?? []} />
        <CategorySection />
      </main>
    </>
  );
}
