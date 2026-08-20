import { supabase } from "../../../lib/supabase";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import MobilePurchaseBar from "@/app/components/MobilePurchaseBar";
import DealWorkCard, { type DealWork } from "@/components/deals/DealWorkCard";
import CompareTray from "@/components/comparison/CompareTray";
import PriceTypes from "@/app/components/PriceTypes";
import { analyzeRecommendation } from "@/lib/analyzers/recommendAnalyzer";
import { isInsightVisible } from "@/lib/insights/visibility";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Work } from "@/types/work";
import { normalizeAffiliateSource } from "@/lib/affiliateTracking";

import {
  analyzeWork,
} from "@/lib/analyzers/analysisAnalyzer";

type WorkDetail = Work & {
  sample_movie_url: string | null;
  long_hit_rank: number | null;
};

const WORK_DETAIL_REVALIDATE_SECONDS = 60 * 60 * 24;
const WORK_DETAIL_CACHE_TAG = "work-detail";

// The official share page nests this DMM player in a minimum 476px-wide iframe.
// Use the same official player directly so its viewport can match narrow phones.
function getOfficialSampleEmbedUrl(work: WorkDetail): string | null {
  if (!work.product_id || !work.sample_movie_url) return null;

  const base = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${encodeURIComponent(work.product_id)}/mtype=AhRVShI_/service=litevideo/mode=part/width=260/height=167`;
  const affiliateId = process.env.DMM_AFFILIATE_ID?.trim();

  return affiliateId
    ? `${base}/affi_id=${encodeURIComponent(affiliateId)}/`
    : `${base}/`;
}

const WORK_DETAIL_COLUMNS = [
  "id", "product_id", "title", "actress", "genre", "maker", "series",
  "score", "actress_score", "genre_score", "maker_score", "series_score",
  "actress_point", "genre_point", "maker_point", "series_point",
  "review_score", "review_count_score", "discount_score", "ranking_score",
  "new_release_score", "long_hit_point", "ranking", "price", "sale_price",
  "list_price", "discount_rate", "review_count", "review_average",
  "release_date", "image_url", "affiliate_url", "stage", "is_on_sale", "sale_end_at",
  "duration", "lowest_price", "previous_realtime_rank", "realtime_rank",
  "sample_movie_url", "long_hit_rank",
].join(",");

// Work data changes at most a few times per day. Reusing the rendered page keeps
// crawler traffic from issuing the same group of Supabase queries on every hit.
export const revalidate = 86400;

// generateMetadata and the page render both need the same row. React cache
// deduplicates that lookup within a single server render.
const getWork = cache(
  unstable_cache(
    async (id: string) => {
      const { data } = await supabase
        .from("works")
        .select(WORK_DETAIL_COLUMNS)
        .eq("id", id)
        .single();

      return data as WorkDetail | null;
    },
    ["work-detail-row"],
    { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [WORK_DETAIL_CACHE_TAG] }
  )
);

const getWorkDetailData = unstable_cache(
  async (productId: string, workId: number) => {
    const [sampleImages, priceHistory, workPrices, insights] = await Promise.all([
      supabase
        .from("work_sample_images")
        .select("image_url, sort_order")
        .eq("product_id", productId)
        .order("sort_order"),
      supabase
        .from("price_history")
        .select("id,changed_at,display_name,type,normal_price,sale_price")
        .eq("product_id", productId)
        .order("changed_at", { ascending: false })
        .limit(100),
      supabase
        .from("work_prices")
        .select("display_name,type,normal_price,sale_price")
        .eq("product_id", productId)
        .order("display_name"),
      supabase
        .from("insights")
        .select("id,type,title,description,created_at,updated_at")
        .eq("work_id", workId)
        .order("priority", { ascending: false }),
    ]);

    return {
      sampleImages: sampleImages.data ?? [],
      priceHistory: priceHistory.data ?? [],
      workPrices: workPrices.data ?? [],
      insights: insights.data ?? [],
    };
  },
  ["work-detail-data"],
  { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [WORK_DETAIL_CACHE_TAG] }
);

const getEntityRanks = unstable_cache(
  async (
    actresses: string[],
    genres: string[],
    makers: string[],
    series: string[]
  ) => {
    const [actressRanks, genreRanks, makerRanks, seriesRanks] = await Promise.all([
      actresses.length
        ? supabase.from("actress_rankings").select("original_rank, fanza_rank").in("name", actresses)
        : Promise.resolve({ data: [] }),
      genres.length
        ? supabase.from("genre_rankings").select("rank").in("name", genres)
        : Promise.resolve({ data: [] }),
      makers.length
        ? supabase.from("maker_rankings").select("rank").in("name", makers)
        : Promise.resolve({ data: [] }),
      series.length
        ? supabase.from("series_rankings").select("original_rank, fanza_rank").in("name", series)
        : Promise.resolve({ data: [] }),
    ]);

    return {
      actressRanks: actressRanks.data ?? [],
      genreRanks: genreRanks.data ?? [],
      makerRanks: makerRanks.data ?? [],
      seriesRanks: seriesRanks.data ?? [],
    };
  },
  ["work-detail-entity-ranks"],
  { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [WORK_DETAIL_CACHE_TAG] }
);

const getRelatedWorks = unstable_cache(
  async (
    workId: number,
    mainActress: string,
    mainSeries: string,
    mainGenre: string,
    mainMaker: string,
  ) => {
    const sources = [
      { column: "series", value: mainSeries, weight: 45 },
      { column: "actress", value: mainActress, weight: 40 },
      { column: "genre", value: mainGenre, weight: 25 },
      { column: "maker", value: mainMaker, weight: 15 },
    ].filter((source) => source.value);

    if (!sources.length) return [];

    const results = await Promise.all(
      sources.map(async (source) => {
        const { data } = await supabase
          .from("works")
          .select("id,title,actress,image_url,score,review_average,review_count,price,sale_price")
          .ilike(source.column, `%${source.value}%`)
          .neq("id", workId)
          .order("score", { ascending: false, nullsFirst: false })
          .limit(10);

        return (data ?? []).map((work) => ({ work, weight: source.weight }));
      }),
    );

    const candidates = new Map<number, { work: (typeof results)[number][number]["work"]; relevance: number }>();
    for (const result of results.flat()) {
      const current = candidates.get(result.work.id);
      const relevance =
        (current?.relevance ?? 0) +
        result.weight +
        Math.max(0, result.work.score ?? 0) * 0.35 +
        Math.max(0, result.work.review_average ?? 0) * 2 +
        (result.work.sale_price > 0 ? 6 : 0);
      candidates.set(result.work.id, { work: result.work, relevance });
    }

    return [...candidates.values()]
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8)
      .map((candidate) => candidate.work);
  },
  ["work-detail-related-works"],
  { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [WORK_DETAIL_CACHE_TAG] }
);

const getValueAlternatives = unstable_cache(
  async (mainGenre: string, workId: number, currentPrice: number) => {
    if (!mainGenre || currentPrice <= 0) return [];
    const minimumPrice = Math.max(1, Math.floor(currentPrice * 0.55));
    const maximumPrice = Math.ceil(currentPrice * 1.45);
    const { data } = await supabase
      .from("works")
      .select("id,title,image_url,price,sale_price,list_price,discount_rate,score,review_average,review_count,sale_end_at,lowest_price,is_bottom_price,sample_movie_url")
      .ilike("genre", `%${mainGenre}%`)
      .neq("id", workId)
      .gte("price", minimumPrice)
      .lte("price", maximumPrice)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(18);

    return ((data ?? []) as DealWork[])
      .sort((a, b) => {
        const aPrice = a.sale_price > 0 ? a.sale_price : a.price;
        const bPrice = b.sale_price > 0 ? b.sale_price : b.price;
        const aValue = (a.sale_price > 0 ? 30 : 0) + a.score - Math.abs(aPrice - currentPrice) / 100;
        const bValue = (b.sale_price > 0 ? 30 : 0) + b.score - Math.abs(bPrice - currentPrice) / 100;
        return bValue - aValue;
      })
      .slice(0, 5);
  },
  ["work-detail-value-alternatives"],
  { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [WORK_DETAIL_CACHE_TAG] }
);



export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  const work = await getWork(id);

  if (!work) {
    return pageMetadata({
      title: "作品情報 | 発掘LAB",
      description: "指定された作品は見つかりませんでした。",
      canonical: `/works/${encodeURIComponent(id)}`,
      robots: { index: false, follow: false },
    });
  }

  const scoreText = typeof work.score === "number" && work.score > 0 ? `・発掘スコア${work.score}` : "";
  const actressText = work.actress ? `${work.actress}出演。` : "";
  const title = `${work.title}｜レビュー${scoreText} | 発掘LAB`;
  const description = `${work.title}のレビュー・評価を掲載。${actressText}作品情報を独自データで分析しています。`;
  const encodedId = encodeURIComponent(id);
  const socialImage = work.image_url || `${SITE_URL}/ogp.png`;
  const metadata = pageMetadata({ title, description, canonical: `/works/${encodedId}` });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      ...metadata.twitter,
      card: "summary_large_image",
      images: [socialImage],
    },
  };
}

export default async function WorkDetailPage(
  {
    params,
    searchParams,
  }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ from?: string | string[] }>;
  }
) {
  const { id } = await params;
  const sourcePage = normalizeAffiliateSource((await searchParams).from);

  const work = await getWork(id);

  if (!work) notFound();

  const { sampleImages, priceHistory, workPrices, insights } =
    await getWorkDetailData(work.product_id, work.id);

  const visibleInsights = (insights ?? []).filter((insight) =>
    isInsightVisible(insight, work)
  );

  const splitEntities = (value: string | null) => value?.split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).filter(Boolean) ?? [];
  const actresses = splitEntities(work.actress);
  const genres = splitEntities(work.genre);
  const makers = splitEntities(work.maker);
  const series = splitEntities(work.series);
  const { actressRanks, genreRanks, makerRanks, seriesRanks } =
    await getEntityRanks(actresses, genres, makers, series);
  const minimumRank = (values: Array<number | null | undefined>) => {
    const ranks = values.filter((value): value is number => typeof value === "number" && value > 0);
    return ranks.length ? Math.min(...ranks) : null;
  };
  const currentPrice = [...(workPrices ?? [])].sort((a, b) =>
    (a.sale_price ?? a.normal_price ?? Number.MAX_SAFE_INTEGER) - (b.sale_price ?? b.normal_price ?? Number.MAX_SAFE_INTEGER)
  )[0] ?? {
    display_name: "代表価格",
    type: null,
    normal_price: work.list_price ?? work.price,
    sale_price: work.sale_price || null,
  };
  const mobileDisplayPrice =
    currentPrice.sale_price && currentPrice.sale_price > 0
      ? currentPrice.sale_price
      : currentPrice.normal_price;
  const mobileDisplayDiscountRate =
    currentPrice.normal_price &&
    mobileDisplayPrice &&
    currentPrice.normal_price > mobileDisplayPrice
      ? Math.round((1 - mobileDisplayPrice / currentPrice.normal_price) * 100)
      : work.discount_rate;
  const recommendationReasons = analyzeRecommendation({
    work,
    currentPrice,
    priceHistory: priceHistory ?? [],
    entityRanks: {
      actress: minimumRank(actressRanks.flatMap((row) => [row.original_rank, row.fanza_rank])),
      genre: minimumRank(genreRanks.map((row) => row.rank)),
      maker: minimumRank(makerRanks.map((row) => row.rank)),
      series: minimumRank(seriesRanks.flatMap((row) => [row.original_rank, row.fanza_rank])),
    },
  });

const mainActress = actresses[0] ?? "";
const mainGenre = genres[0] ?? "";
const mainMaker = makers[0] ?? "";
const mainSeries = series[0] ?? "";
const relatedWorks = await getRelatedWorks(
  work.id,
  mainActress,
  mainSeries,
  mainGenre,
  mainMaker,
);
const valueAlternatives = await getValueAlternatives(
  mainGenre,
  work.id,
  mobileDisplayPrice ?? 0
);

  const {
  summary,
  goodPoints,
  cautionPoints,
  conclusion,
} = analyzeWork(work);

  const lowestPriceType = currentPrice.display_name ?? "";

const chartData = createChartData(
  priceHistory ?? [],
  lowestPriceType
);

  return (
  <main className="min-h-screen bg-gray-100 py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
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
  officialSampleEmbedUrl={getOfficialSampleEmbedUrl(work)}
/>
      </section>

      {/* タイムライン */}
      {visibleInsights.length > 0 && (
        <section className="mt-8 hidden md:block">
          <InsightTimeline insights={visibleInsights} />
        </section>
      )}

      {/* タブ */}
      <section className="mt-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <WorkTabs
            analysis={
              <AIAnalysis
                work={work}
                chartData={chartData}
                recommendationReasons={recommendationReasons}
              />
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
                <PriceTypes prices={workPrices ?? []} />
                <PriceHistory history={priceHistory ?? []} />
              </div>
            }
            info={<WorkInfo work={work} />}
            related={<RelatedWorks works={relatedWorks ?? []} />}
          />

          <PurchaseCard
            work={work}
            offers={workPrices ?? []}
            checkedAt={priceHistory[0]?.changed_at ?? null}
            sampleMovieAvailable={!!work.sample_movie_url}
            recommendationReasons={recommendationReasons}
            sourcePage={sourcePage}
          />
        </div>
      </section>

      {valueAlternatives.length > 0 && (
        <section className="mt-10 rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-7" aria-labelledby="value-alternatives">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-widest text-emerald-600">COMPARE BEFORE BUYING</p>
              <h2 id="value-alternatives" className="mt-1 text-2xl font-black">同価格帯のおすすめと買い比べ</h2>
              <p className="mt-2 text-sm text-slate-500">「{mainGenre}」から、価格が近く評価・セール条件の良い候補を選びました。</p>
            </div>
            <Link href={`/deals/under-1000`} className="text-sm font-black text-pink-600 hover:underline">さらにお得な作品を見る →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {valueAlternatives.map((alternative) => <DealWorkCard key={alternative.id} work={alternative} source="comparison" />)}
          </div>
        </section>
      )}

      <SampleImageCarousel
  images={sampleImages ?? []}
/>

      {/* 関連ページ */}
      <section className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">

        <h2 className="mb-5 text-2xl font-black">
          🔗 関連ページ
        </h2>

        <div className="flex flex-wrap gap-3">

          {actresses.map((actress) => (
            <Link
              key={`actress-${actress}`}
              href={`/actress/${encodeURIComponent(actress)}`}
              className="rounded-xl bg-pink-100 px-4 py-2 font-semibold hover:bg-pink-200"
            >
              👩 {actress}の作品一覧
            </Link>
          ))}

          {genres.map((genre) => (
            <Link
              key={`genre-${genre}`}
              href={`/genre/${encodeURIComponent(genre)}`}
              className="rounded-xl bg-indigo-100 px-4 py-2 font-semibold hover:bg-indigo-200"
            >
              🏷 {genre}
            </Link>
          ))}

          {makers.map((maker) => (
            <Link
              key={`maker-${maker}`}
              href={`/maker/${encodeURIComponent(maker)}`}
              className="rounded-xl bg-green-100 px-4 py-2 font-semibold hover:bg-green-200"
            >
              🏢 {maker}
            </Link>
          ))}

          {series.map((seriesName) => (
            <Link
              key={`series-${seriesName}`}
              href={`/series/${encodeURIComponent(seriesName)}`}
              className="rounded-xl bg-yellow-100 px-4 py-2 font-semibold hover:bg-yellow-200"
            >
              📚 {seriesName}
            </Link>
          ))}

        </div>

      </section>

    </div>
    <MobilePurchaseBar
      work={work}
      displayPrice={mobileDisplayPrice}
      displayDiscountRate={mobileDisplayDiscountRate}
      sourcePage={sourcePage}
    />
    <CompareTray />
  </main>
);
}
