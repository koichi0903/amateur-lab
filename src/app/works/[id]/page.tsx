import { supabase } from "../../../lib/supabase";
import type { Metadata } from "next";
import WorkHero from "../../components/WorkHero";
import WorkInfo from "../../components/WorkInfo";
import AIAnalysis from "../../components/AIAnalysis";
import RelatedWorks from "../../components/RelatedWorks";
import PriceHistory from "@/app/components/PriceHistory";
import Breadcrumb from "@/app/components/Breadcrumb";
import BreadcrumbJsonLd from "@/app/components/BreadcrumbJsonLd";
import Link from "next/link";
import ProductJsonLd from "@/app/components/ProductJsonLd";
import InsightTimeline from "@/app/components/InsightTimeline";
import WorkTabs from "@/app/components/WorkTabs";
import PurchaseCard from "@/app/components/PurchaseCard";
import { createChartData } from "@/lib/createChartData";
import ReviewTab from "@/app/components/ReviewTab";
import SampleImageCarousel from "@/app/components/SampleImageCarousel";

import {
  analyzeWork,
} from "@/lib/analyzers/analysisAnalyzer";



export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  const { data: work } = await supabase
  .from("works")
  .select("*")
  .eq("id", id)
  .single();

  if (!work) {
    return {
      title: "作品情報 | 発掘LAB",
    };
  }

  return {
  title: `${work.title}｜レビュー・発掘スコア${work.score} | 発掘LAB`,
  description:
    `${work.title}のレビュー・評価・発掘スコアを掲載。女優「${work.actress}」出演作品を独自アルゴリズムで分析しています。`,

  alternates: {
    canonical: `/works/${id}`,
  },

  keywords: [
  work.title,
  work.actress,
  "FANZA",
  "レビュー",
  "AV",
  "発掘LAB",
  "おすすめ作品",
],

  openGraph: {
  title: `${work.title} | 発掘LAB`,
  description: `${work.title}のレビュー・評価・発掘スコアを掲載しています。`,
  type: "article",
  images: [work.image_url],
},
  
    };
}

export default async function WorkDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: work } = await supabase
    .from("works")
    .select("*")
    .eq("id", id)
    .single();

  const { data: sampleImages } = await supabase
  .from("work_sample_images")
  .select("image_url, sort_order")
  .eq("product_id", work?.product_id)
  .order("sort_order");

  const { data: priceHistory } = await supabase
  .from("price_history")
  .select("*")
  .eq("product_id", work?.product_id)
  .order("changed_at", {
  ascending: false,
})
  .limit(100)

  const { data: workPrices } = await supabase
  .from("work_prices")
  .select("*")
  .eq("product_id", work?.product_id)
  .order("display_name");

  const { data: insights } = await supabase
  .from("insights")
  .select("*")
  .eq("work_id", work?.id)
  .order("priority", {
    ascending: false,
  });

  if (!work) {
    return <div>作品が見つかりません</div>;
  }

  const mainActress =
  work.actress?.split(" / ")[0] || "";

const { data: relatedWorks } = await supabase
  .from("works")
  .select("*")
  .ilike(
    "actress",
    `%${mainActress}%`
  )
  .neq("id", work.id)
  .limit(6);

  const {
  summary,
  comments,
  goodPoints,
  cautionPoints,
  conclusion,
} = analyzeWork(work);

  const lowestPriceType =
  [...(workPrices ?? [])]
    .sort(
      (a, b) =>
        (a.sale_price ?? a.normal_price) -
        (b.sale_price ?? b.normal_price)
    )[0]?.display_name ?? "";

const chartData = createChartData(
  priceHistory ?? [],
  lowestPriceType
);

  return (
  <main className="min-h-screen bg-gray-100 py-8">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">

      <Breadcrumb
        items={[
          { label: "🏠 TOP", href: "/" },
          { label: work.title },
        ]}
      />

      <BreadcrumbJsonLd
        items={[
          { name: "TOP", url: "/" },
          { name: work.title, url: `/works/${work.id}` },
        ]}
      />

      <ProductJsonLd work={work} />

      {/* Hero */}
      <section className="mt-6 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm sm:p-8">
        <WorkHero
  work={work}
  sampleImages={sampleImages ?? []}
  sampleMovieUrl={work.sample_movie_url}
/>
      </section>

      <div className="mt-8 rounded-3xl border border-pink-100 bg-pink-50 p-4 sm:p-6">

  <h3 className="text-xl font-black text-pink-700">
    🔥 AIがこの作品をおすすめする理由
  </h3>

  <div className="mt-5 grid gap-4 md:grid-cols-4">

    <div className="rounded-2xl border border-green-200 bg-white p-4">
      <div className="text-sm font-black text-green-700">
        💚 過去最安値
      </div>

      <div className="mt-2 text-xs leading-6 text-zinc-600">
        通常価格より安く購入できます
      </div>
    </div>

    <div className="rounded-2xl border border-pink-200 bg-white p-4">
      <div className="text-sm font-black text-pink-700">
        📈 ランキング上昇
      </div>

      <div className="mt-2 text-xs leading-6 text-zinc-600">
        人気ランキング上位作品
      </div>
    </div>

    <div className="rounded-2xl border border-amber-200 bg-white p-4">
      <div className="text-sm font-black text-amber-700">
        ⭐ 高評価
      </div>

      <div className="mt-2 text-xs leading-6 text-zinc-600">
        レビュー評価{work.review_average}
      </div>
    </div>

    <div className="rounded-2xl border border-indigo-200 bg-white p-4">
      <div className="text-sm font-black text-indigo-700">
        🏆 発掘スコア
      </div>

      <div className="mt-2 text-xs leading-6 text-zinc-600">
        発掘スコア {work.score}点
      </div>
    </div>

  </div>

</div>

      {/* タイムライン */}
      <section className="mt-8">
        <InsightTimeline
          insights={insights ?? []}
        />
      </section>

      {/* タブ */}
      <section className="mt-8">

        <WorkTabs

          analysis={

            <div className="space-y-8">

              <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">

                <div className="min-w-0">

  <AIAnalysis
    work={work}
    summary={summary}
    comments={comments}
    chartData={chartData}
  />

</div>

                <PurchaseCard
                  work={work}
                />

              </div>

            </div>

          }

          review={
  <ReviewTab
  work={work}
  summary={summary}
  goodPoints={goodPoints}
  cautionPoints={cautionPoints}
  conclusion={conclusion}
/>
}

          price={
            <div className="space-y-8">

              <PriceHistory
                history={priceHistory ?? []}
              />

            </div>
          }

          info={
            <WorkInfo
              work={work}
            />
          }

          related={
            <RelatedWorks
              works={relatedWorks ?? []}
            />
          }

        />

      </section>

      <SampleImageCarousel
  images={sampleImages ?? []}
/>

      {/* 関連ページ */}
      <section className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">

        <h2 className="mb-5 text-2xl font-black">
          🔗 関連ページ
        </h2>

        <div className="flex flex-wrap gap-3">

          {mainActress && (
            <Link
              href={`/actress/${encodeURIComponent(mainActress)}`}
              className="rounded-xl bg-pink-100 px-4 py-2 font-semibold hover:bg-pink-200"
            >
              👩 {mainActress}の作品一覧
            </Link>
          )}

          {work.genre && (
            <Link
              href={`/genre/${encodeURIComponent(work.genre)}`}
              className="rounded-xl bg-indigo-100 px-4 py-2 font-semibold hover:bg-indigo-200"
            >
              🏷 {work.genre}
            </Link>
          )}

          {work.maker && (
            <Link
              href={`/maker/${encodeURIComponent(work.maker)}`}
              className="rounded-xl bg-green-100 px-4 py-2 font-semibold hover:bg-green-200"
            >
              🏢 {work.maker}
            </Link>
          )}

          {work.series && (
            <Link
              href={`/series/${encodeURIComponent(work.series)}`}
              className="rounded-xl bg-yellow-100 px-4 py-2 font-semibold hover:bg-yellow-200"
            >
              📚 {work.series}
            </Link>
          )}

        </div>

      </section>

    </div>
  </main>
);
}
