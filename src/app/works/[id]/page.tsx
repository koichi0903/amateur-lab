import { supabase } from "../../../lib/supabase";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkDetailHero from "../../components/WorkDetailHero";
import RelatedWorks from "../../components/RelatedWorks";
import Breadcrumb from "@/app/components/Breadcrumb";
import BreadcrumbJsonLd from "@/app/components/BreadcrumbJsonLd";
import ProductJsonLd from "@/app/components/ProductJsonLd";
import WorkPageViewTracker from "@/app/components/WorkPageViewTracker";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { isOfficialSampleMovieUrl } from "@/lib/officialSampleMovie";
import {
  isWorkIndexable,
  WORK_INDEX_MIN_PRICE,
} from "@/lib/seoQuality";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Work } from "@/types/work";
import Header from "@/components/layout/Header";
import MobilePurchaseBar from "@/app/components/MobilePurchaseBar";


function currentTimeMs() {
  return Date.now();
}

type WorkDetail = Work & {
  sample_movie_url: string | null;
  long_hit_rank: number | null;
};

const WORK_DETAIL_REVALIDATE_SECONDS = 60 * 60 * 24;
const workDetailCacheTag = (workId: string | number) => `work-detail:${String(workId)}`;
const workDetailProductCacheTag = (productId: string) => `work-detail-product:${productId}`;

function getOfficialSampleEmbedUrl(work: WorkDetail): string | null {
  if (!work.product_id || !isOfficialSampleMovieUrl(work.sample_movie_url)) return null;

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
  "daily_rank", "weekly_rank", "monthly_rank",
  "release_date", "image_url", "affiliate_url", "stage", "is_on_sale", "sale_end_at",
  "duration", "lowest_price", "is_lowest_price", "is_bottom_price", "previous_realtime_rank", "realtime_rank",
  "sample_movie_url", "long_hit_rank", "url",
].join(",");

export const revalidate = 86400;

function isValidWorkId(id: string): boolean {
  return /^\d{1,10}$/.test(id);
}

export async function generateStaticParams() {
  return [];
}

// generateMetadata and the page render both need the same row. React cache
// deduplicates that lookup within a single server render.
const getWork = cache(
  async (id: string) =>
    unstable_cache(
      async () => {
        const { data, error } = await supabase
          .from("works")
          .select(WORK_DETAIL_COLUMNS)
          .eq("id", id)
          .neq("stage", "DISCONTINUED")
          .gte("price", WORK_INDEX_MIN_PRICE)
          .not("image_url", "is", null)
          .neq("image_url", "")
          .not("affiliate_url", "is", null)
          .neq("affiliate_url", "")
          .maybeSingle();

        if (error) {
          console.error("[work-detail] failed to load work", { id, error });
        }

        return data as WorkDetail | null;
      },
      ["work-detail-row-v3-duration-text-purchase-signals", id],
      { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [workDetailCacheTag(id)] },
    )(),
);

const getWorkDetailData = cache(
  async (productId: string) =>
    unstable_cache(
      async () => {
    const [sampleImages, priceHistory, workPrices] = await Promise.all([
      supabase
        .from("work_sample_images")
        .select("image_url, sort_order")
        .eq("product_id", productId)
        .order("sort_order"),
      supabase
        .from("price_history")
        .select("id,changed_at,display_name,type,period,price_kind,normal_price,sale_price")
        .eq("product_id", productId)
        .order("changed_at", { ascending: false })
        .limit(100),
      supabase
        .from("work_prices")
        .select("display_name,type,period,price_kind,normal_price,sale_price")
        .eq("product_id", productId)
        .order("display_name"),
    ]);

    return {
      sampleImages: sampleImages.data ?? [],
      priceHistory: priceHistory.data ?? [],
      workPrices: workPrices.data ?? [],
    };
      },
      // Versioned after adding period-aware price history. This prevents the old
      // period-less payload from hiding the 7-day and unlimited series.
      ["work-detail-data-v4-period-keyed-current-offers", productId],
      { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [workDetailProductCacheTag(productId)] },
    )(),
);

const getRelatedWorks = cache(
  async (
    workId: number,
    mainActress: string,
    mainSeries: string,
    mainGenre: string,
    mainMaker: string,
  ) =>
    unstable_cache(
      async () => {
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
          .select("id,product_id,title,actress,genre,maker,series,image_url,score,review_average,review_count,price,sale_price,list_price,discount_rate,sale_end_at,affiliate_url,stage")
          .ilike(source.column, `%${source.value}%`)
          .neq("id", workId)
          .order("score", { ascending: false, nullsFirst: false })
          .limit(18);

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
      .slice(0, 12)
      .map((candidate) => candidate.work) as unknown as Work[];
      },
      ["work-detail-related-works", String(workId), mainActress, mainSeries, mainGenre, mainMaker],
      { revalidate: WORK_DETAIL_REVALIDATE_SECONDS, tags: [workDetailCacheTag(workId)] },
    )(),
);

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  if (!isValidWorkId(id)) {
    return pageMetadata({
      title: "作品情報 | 発掘LAB",
      description: "指定された作品は見つかりませんでした。",
      canonical: `/works/${encodeURIComponent(id)}`,
      robots: { index: false, follow: false },
    });
  }

  const work = await getWork(id);

  if (!work) {
    return pageMetadata({
      title: "作品情報 | 発掘LAB",
      description: "指定された作品は見つかりませんでした。",
      canonical: `/works/${encodeURIComponent(id)}`,
      robots: { index: false, follow: false },
    });
  }

  const actressText = work.actress ? `${work.actress}出演。` : "";
  const currentPrice = work.sale_price > 0 ? work.sale_price : work.price;
  const priceText = currentPrice > 0 ? `現在価格${currentPrice.toLocaleString("ja-JP")}円。` : "";
  const reviewText = work.review_count > 0
    ? `レビュー${work.review_average.toFixed(2)}（${work.review_count}件）。`
    : "";
  const title = `${work.title}｜FANZA価格・過去最安値・買い時 | 発掘LAB`;
  const description = `${work.title}のFANZA現在価格、価格推移、過去最安値、買い時を確認。${priceText}${reviewText}${actressText}同価格帯の作品とも比較できます。`;
  const encodedId = encodeURIComponent(id);
  const socialImage = work.image_url || `${SITE_URL}/ogp.png`;
  const metadata = pageMetadata({
    title,
    description,
    canonical: `/works/${encodedId}`,
    robots: isWorkIndexable(work)
      ? undefined
      : { index: false, follow: true },
  });

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
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;

  if (!isValidWorkId(id)) notFound();

  const work = await getWork(id);

  if (!work) notFound();

  const { sampleImages, priceHistory, workPrices } =
    await getWorkDetailData(work.product_id);
  const latestOffers = new Map<string, (typeof priceHistory)[number]>();
  for (const offer of priceHistory ?? []) {
    const key = `${offer.display_name ?? offer.type ?? ""}\u0000${offer.period ?? ""}`;
    if (!latestOffers.has(key)) latestOffers.set(key, offer);
  }
  // Current offers are authoritative. History can contain plans that ended,
  // so deriving the purchase list from it can resurrect stale price options.
  const currentOffers = workPrices?.length
    ? workPrices
    : [...latestOffers.values()];

  const splitEntities = (value: string | null) => value?.split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).filter(Boolean) ?? [];
  const actresses = splitEntities(work.actress);
  const genres = splitEntities(work.genre);
  const makers = splitEntities(work.maker);
  const series = splitEntities(work.series);
  const saleActive = !work.sale_end_at || Date.parse(work.sale_end_at) > currentTimeMs();
  const hasSaleEvidence =
    saleActive &&
    (work.is_on_sale || (work.sale_price != null && work.sale_price > 0) || (work.discount_rate != null && work.discount_rate > 0));
  const representativePrice = hasSaleEvidence && work.sale_price > 0 ? work.sale_price : work.price;
  const currentPrice = currentOffers.find((offer) =>
    (offer.sale_price ?? offer.normal_price ?? 0) === representativePrice
  ) ?? {
    display_name: "代表価格",
    type: null,
    period: null,
    normal_price: work.price,
    sale_price: hasSaleEvidence ? work.sale_price || null : null,
  };
  const mobileDisplayPrice =
    hasSaleEvidence && currentPrice.sale_price && currentPrice.sale_price > 0
      ? currentPrice.sale_price
      : currentPrice.normal_price;
  const mobileDisplayDiscountRate =
    hasSaleEvidence &&
    currentPrice.sale_price &&
    currentPrice.normal_price &&
    mobileDisplayPrice &&
    currentPrice.normal_price > mobileDisplayPrice
      ? Math.round((1 - mobileDisplayPrice / currentPrice.normal_price) * 100)
      : hasSaleEvidence ? work.discount_rate : 0;
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

  return (
  <>
  <Header />
  <main className="min-h-screen bg-gray-100 py-8 pb-24 md:pb-8">
    <WorkPageViewTracker
      workId={work.id}
      price={mobileDisplayPrice ?? null}
      discountRate={mobileDisplayDiscountRate ?? null}
      discoveryScore={null}
      ranking={typeof work.ranking === "number" ? work.ranking : null}
    />
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6">

      <Breadcrumb
        variant="compact"
        items={[
          { label: "ホーム", href: "/" },
          ...(mainMaker ? [{ label: mainMaker, href: `/maker/${encodeURIComponent(mainMaker)}` }] : []),
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
      <section className="mt-0 p-0 sm:p-8">
<WorkDetailHero
  work={work}
  sampleImages={sampleImages ?? []}
  sampleMovieUrl={work.sample_movie_url}
  officialSampleEmbedUrl={getOfficialSampleEmbedUrl(work)}
  priceHistory={priceHistory ?? []}
  displayPrice={mobileDisplayPrice ?? null}
  regularPrice={currentPrice.normal_price ?? work.price ?? null}
  discountRate={mobileDisplayDiscountRate}
/>
      </section>

      <RelatedWorks works={relatedWorks ?? []} />

    </div>
  </main>
  <MobilePurchaseBar
    work={work}
    displayPrice={mobileDisplayPrice}
    displayDiscountRate={mobileDisplayDiscountRate}
  />
  </>
);
}
