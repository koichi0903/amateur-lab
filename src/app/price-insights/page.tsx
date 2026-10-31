import type { Metadata } from "next";
import Link from "next/link";
import { BadgeJapaneseYen, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import PriceInsightWorkCard from "@/app/price-insights/PriceInsightWorkCard";
import { getHomePriceInsights, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 1800;
// Price history is runtime Supabase data. Keep this SEO page server-rendered,
// but do not make the production build depend on external database access.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "FANZA作品の買い時・過去最安値ランキング | 発掘LAB",
  description:
    "FANZA作品の現在価格、価格推移、過去最安値、割引、レビューを比較し、今買うか待つか判断できる作品を紹介します。",
  canonical: "/price-insights",
});

export default async function PriceInsightsPage() {
  let buyTiming: HomePriceInsightWork[] = [];
  try {
    buyTiming = (await getHomePriceInsights()).buyTiming;
  } catch (error) {
    console.warn("[price-insights] data is temporarily unavailable", error);
  }
  const structuredItems = buyTiming.map((work) => ({
    name: work.title,
    url: `${SITE_URL}/works/${work.id}`,
    image: work.image_url,
  }));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="今日の買い時ランキング"
          description="価格・レビュー・収益ファネルを総合した買い時作品ランキングです。"
          url={`${SITE_URL}/price-insights`}
          items={structuredItems}
        />

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">
              TOP / FANZA作品の買い時
            </Link>
            <div className="mt-5 flex max-w-4xl items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600">
                <BadgeJapaneseYen size={30} />
              </span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-pink-600">
                  BUY TIMING RANKING
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  FANZA作品の買い時・過去最安値ランキング
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                  値下げ幅、過去最安値との近さ、レビューの安定感を合わせて、今買うか待つか判断しやすい作品を並べています。価格だけでなく、作品詳細で価格履歴と同価格帯の候補も確認できます。
                </p>
              </div>
            </div>

            <nav aria-label="買い時関連ページ" className="mt-5 flex flex-wrap gap-2 text-sm font-black">
              <Link href="/reports/price-drops" className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700 hover:border-emerald-300">7日レンタル300円以下</Link>
              <Link href="/reports/price-bands" className="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-pink-700 hover:border-pink-300">価格帯別に比較</Link>
              <Link href="/compare-guide" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:border-pink-300 hover:text-pink-600">比較の方法</Link>
              <Link href="/reports/sale-ending" className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-amber-700 hover:border-amber-300">終了間近のセール</Link>
              <Link href="/guides/sale-buying-guide" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:border-pink-300 hover:text-pink-600">セールの見方</Link>
            </nav>

            <div className="mt-8 grid gap-3 rounded-2xl border border-pink-100 bg-white p-5 text-sm font-bold leading-6 text-slate-600 sm:grid-cols-3">
              <p className="flex gap-2">
                <ShieldCheck className="shrink-0 text-emerald-600" size={20} />
                少ないPVのCTRは信頼度補正
              </p>
              <p className="flex gap-2">
                <Sparkles className="shrink-0 text-pink-600" size={20} />
                発掘指数とは別に判定
              </p>
              <p className="flex gap-2">
                <TrendingUp className="shrink-0 text-indigo-600" size={20} />
                詳細ページと同じ基準
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {buyTiming.length === 0 ? (
            <div className="border-y border-slate-200 bg-white px-5 py-12 text-center">
              <p className="font-black text-slate-800">買い時データを更新しています</p>
              <p className="mt-2 text-sm text-slate-500">
                時間をおいて再読み込みしてください。
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {buyTiming.map((work, index) => <PriceInsightWorkCard key={work.id} work={work} index={index} />)}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

