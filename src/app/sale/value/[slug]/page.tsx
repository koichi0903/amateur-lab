import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import Header from "@/components/layout/Header";
import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import { getSaleValueCampaign, saleValueCampaigns } from "@/lib/saleValueCampaigns";
import { pageMetadata } from "@/lib/seo";
import { parseDatabaseDate } from "@/lib/dateTime";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";

export const revalidate = 900;

const PAGE_SIZE = 24;
const CAMPAIGN_COLUMNS = "id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,score,review_average,review_count,sale_end_at,sample_movie_url,is_bottom_price,lowest_price,ranking,realtime_rank,affiliate_url,last_updated";

type CampaignWork = Pick<Work, "id" | "product_id" | "title" | "image_url" | "actress" | "genre" | "maker" | "series" | "price" | "sale_price" | "list_price" | "discount_rate" | "score" | "review_average" | "review_count" | "sale_end_at" | "sample_movie_url" | "is_bottom_price" | "lowest_price" | "ranking" | "realtime_rank" | "affiliate_url"> & { last_updated: string | null };

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function displayedPrice(work: CampaignWork, now: number) {
  const endAt = parseDatabaseDate(work.sale_end_at)?.getTime();
  const saleActive = work.sale_price > 0 && work.price > work.sale_price && (endAt == null || endAt > now);
  return saleActive ? work.sale_price : work.price;
}

function rankValue(work: CampaignWork, now: number) {
  const currentPrice = displayedPrice(work, now);
  const recordedLow = work.lowest_price;
  const hasLow = recordedLow != null && recordedLow > 0;
  const gapRate = hasLow ? (currentPrice - recordedLow) / recordedLow : Number.POSITIVE_INFINITY;
  return { currentPrice, recordedLow: hasLow ? recordedLow : null, gapRate };
}

async function fetchCampaignWorks(campaign: NonNullable<ReturnType<typeof getSaleValueCampaign>>) {
  const rows: CampaignWork[] = [];
  const pageSize = 500;
  let offset = 0;
  let targetCount: number | null = null;
  while (targetCount == null || offset < targetCount) {
    const { data, count, error } = await supabase
      .from("works")
      .select(CAMPAIGN_COLUMNS, { count: "exact" })
      .eq("is_on_sale", true)
      .eq("sale_price", campaign.salePrice)
      .eq("sale_end_at", campaign.saleEndAtStored)
      .gt("price", campaign.salePrice)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Failed to load sale campaign works.");
    targetCount = count ?? rows.length;
    const batch = (data ?? []) as unknown as CampaignWork[];
    rows.push(...batch);
    if (!batch.length || batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export function generateStaticParams() {
  return saleValueCampaigns.map((campaign) => ({ slug: campaign.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const campaign = getSaleValueCampaign(slug);
  if (!campaign) return {};
  return pageMetadata({ title: `${campaign.name}｜記録最安値順 | 発掘LAB`, description: campaign.description, canonical: `/sale/value/${campaign.slug}` });
}

export default async function SaleValuePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campaign = getSaleValueCampaign(slug);
  if (!campaign) notFound();
  const page = parsePage(query.page);
  const allWorks = await fetchCampaignWorks(campaign);
  const now = Date.now();
  const rankedWorks = allWorks
    .map((work) => ({ work, value: rankValue(work, now) }))
    .sort((a, b) =>
      Number(a.value.recordedLow == null) - Number(b.value.recordedLow == null) ||
      Number(a.value.gapRate > 0) - Number(b.value.gapRate > 0) ||
      a.value.gapRate - b.value.gapRate ||
      a.work.id - b.work.id,
    );
  const pageCount = Math.max(1, Math.ceil(rankedWorks.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageWorks = rankedWorks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const insightWorks = pageWorks.map(({ work }) => work as unknown as HomePriceInsightWork);
  let insights: HomePriceInsightWork[] = [];
  if (insightWorks.length) {
    try {
      insights = await buildInsightsForWorks(insightWorks, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), { requireBuyTimingSignal: false });
    } catch (error) {
      console.warn("[sale-value] price histories are temporarily unavailable", error);
    }
  }
  const insightById = new Map(insights.map((insight) => [insight.id, insight]));
  const lastUpdated = allWorks.reduce<string | null>((latest, work) => work.last_updated && (!latest || work.last_updated > latest) ? work.last_updated : latest, null);
  const priceDate = lastUpdated
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).format(parseDatabaseDate(lastUpdated) ?? new Date(lastUpdated))
    : "取得日時不明";
  const pageHref = (target: number) => target <= 1 ? `/sale/value/${slug}` : `/sale/value/${slug}?page=${target}`;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
            <Link href="/sale" className="text-xs font-bold text-slate-500 hover:text-pink-600">開催中のFANZAセールを見る</Link>
            <p className="mt-5 text-xs font-black tracking-widest text-pink-600">RECORDED LOW PRICE CHECK</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">{campaign.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">定価からの割引率だけではなく、発掘LABの記録上の最安値と比べて、現在どれだけ近い価格かを確認できます。</p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-500">セール期間</dt><dd className="mt-1 font-black">{campaign.startsAtLabel}〜{campaign.endsAtLabel}</dd></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-500">対象件数</dt><dd className="mt-1 font-black">{rankedWorks.length.toLocaleString("ja-JP")}作品</dd></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-500">価格取得日</dt><dd className="mt-1 font-black">{priceDate}</dd></div>
            </dl>
          </div>
        </section>
        <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
          <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            <p className="font-black">並び順の根拠</p>
            <p className="mt-1">作品ページに使う通常販売価格系列の記録最安値と現在価格を比較し、最安値を更新した作品・最安値タイを最上位に置き、その後は最安値からの乖離率が小さい順です。通常価格に対する割引率と90日間の価格推移もカードに表示します。価格は取得時点の記録です。</p>
          </div>
          {pageWorks.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {pageWorks.map(({ work, value }, index) => (
                <FanzaStyleWorkCard key={work.id} work={work as unknown as Work} sourcePage="sale" itemListName={`sale-value-${campaign.slug}`} rank={(safePage - 1) * PAGE_SIZE + index + 1} insight={insightById.get(work.id)} valueComparison={{ currentPrice: value.currentPrice, recordedLow: value.recordedLow }} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-black">対象作品の価格データを確認できませんでした</p><p className="mt-2 text-sm text-slate-500">セールの登録条件と価格更新状況を確認してください。</p></div>
          )}
          {pageCount > 1 && <nav aria-label="セールのお得度順ページ送り" className="mt-8 flex items-center justify-center gap-4 text-sm font-bold">
            {safePage > 1 ? <Link href={pageHref(safePage - 1)} className="rounded-full border border-slate-200 bg-white px-4 py-2">前へ</Link> : <span />}
            <span>{safePage} / {pageCount}</span>
            {safePage < pageCount ? <Link href={pageHref(safePage + 1)} className="rounded-full border border-slate-200 bg-white px-4 py-2">次へ</Link> : <span />}
          </nav>}
        </section>
      </main>
    </>
  );
}
