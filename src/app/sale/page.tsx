import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";
import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";

const PAGE_SIZE = 24;
export const revalidate = 86400;

type SaleParams = {
  page?: string;
  sort?: string;
  maxPrice?: string;
  minRating?: string;
};

const saleSorts = ["popular", "discount", "price", "rating", "ending"] as const;
type SaleSort = (typeof saleSorts)[number];

function normalizeSort(value?: string): SaleSort {
  return saleSorts.includes(value as SaleSort) ? value as SaleSort : "popular";
}

function parsePositiveNumber(value?: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SaleParams> }): Promise<Metadata> {
  const params = await searchParams;
  const page = parsePage(params.page);
  const hasFilters = Boolean(params.sort || params.maxPrice || params.minRating);
  return pageMetadata({
    title: `FANZAセール中の作品${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "現在セール中のFANZA作品を、人気順に紹介します。価格・割引・レビューを比較できます。",
    canonical: page > 1 ? `/sale?page=${page}` : "/sale",
    robots: hasFilters ? { index: false, follow: true } : undefined,
  });
}

function SaleCard({ work, insight }: { work: Work; insight?: HomePriceInsightWork }) {
  return <FanzaStyleWorkCard work={work} sourcePage="sale" insight={insight} />;
}

function formatTodayJa() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}年${value("month")}月${value("day")}日`;
}

export default async function SalePage({ searchParams }: { searchParams: Promise<SaleParams> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const sort = normalizeSort(params.sort);
  const maxPrice = parsePositiveNumber(params.maxPrice);
  const minRating = parsePositiveNumber(params.minRating);
  const offset = (page - 1) * PAGE_SIZE;
  let query = supabase
    .from("works")
    .select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,score,review_average,review_count,sale_end_at,sample_movie_url,is_bottom_price,lowest_price,ranking,realtime_rank,affiliate_url", { count: "exact" })
    .gt("sale_price", 0)
    .gt("discount_rate", 0);

  if (maxPrice) query = query.lte("sale_price", maxPrice);
  if (minRating) query = query.gte("review_average", minRating);
  if (sort === "price") query = query.order("sale_price", { ascending: true });
  else if (sort === "rating") query = query.order("review_average", { ascending: false }).order("review_count", { ascending: false });
  else if (sort === "ending") query = query.gt("sale_end_at", new Date().toISOString()).order("sale_end_at", { ascending: true, nullsFirst: false });
  else if (sort === "discount") query = query.order("discount_rate", { ascending: false }).order("review_count", { ascending: false, nullsFirst: false });
  else query = query.order("realtime_rank", { ascending: true, nullsFirst: false }).order("review_count", { ascending: false, nullsFirst: false });

  const { data, count, error } = await query.range(offset, offset + PAGE_SIZE - 1);

  const works = (data ?? []) as unknown as Work[];
  let saleInsights: HomePriceInsightWork[] = [];
  if (works.length) {
    try {
      saleInsights = await buildInsightsForWorks(
        works as unknown as HomePriceInsightWork[],
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        { requireBuyTimingSignal: false },
      );
    } catch (historyError) {
      console.warn("[sale] price histories are temporarily unavailable", historyError);
    }
  }
  const saleInsightsById = new Map(saleInsights.map((insight) => [insight.id, insight]));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const today = formatTodayJa();
  const pageHref = (target: number) => {
    const queryParams = new URLSearchParams();
    if (target > 1) queryParams.set("page", String(target));
    if (sort !== "popular") queryParams.set("sort", sort);
    if (maxPrice) queryParams.set("maxPrice", String(maxPrice));
    if (minRating) queryParams.set("minRating", String(minRating));
    return queryParams.size ? `/sale?${queryParams}` : "/sale";
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <section className="bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <h1 className="text-2xl font-black tracking-tight">今日（{today}）のFANZAセール情報</h1>
            <form action="/sale" className="mt-5 flex max-w-[860px] flex-wrap items-end gap-3">
              <label className="w-[calc(100%-88px)] text-xs font-black text-slate-600 sm:w-[220px]">並び順<select name="sort" defaultValue={sort} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="popular">人気順</option><option value="discount">割引率が高い順</option><option value="price">価格が安い順</option><option value="rating">レビュー評価順</option><option value="ending">終了が近い順</option></select></label>
              <label className="hidden w-full text-xs font-black text-slate-600 sm:block sm:w-[220px]">上限価格<select name="maxPrice" defaultValue={maxPrice ?? ""} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="500">500円以下</option><option value="1000">1,000円以下</option><option value="2000">2,000円以下</option></select></label>
              <label className="hidden w-full text-xs font-black text-slate-600 sm:block sm:w-[220px]">レビュー<select name="minRating" defaultValue={minRating ?? ""} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="3.5">3.5以上</option><option value="4">4.0以上</option><option value="4.5">4.5以上</option></select></label>
              <button type="submit" className="h-11 shrink-0 rounded bg-slate-950 px-4 text-sm font-black text-white hover:bg-pink-600 sm:px-6">検索</button>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          {error ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center font-black">セール作品を読み込めませんでした</div>
          ) : works.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{works.map((work) => <SaleCard key={work.id} work={work} insight={saleInsightsById.get(work.id)} />)}</div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-black">現在掲載中のセール作品はありません</p></div>
          )}

          {totalPages > 1 && (
            <nav aria-label="セール作品のページ送り" className="mt-10 flex items-center justify-center gap-3">
              {page > 1 ? <Link href={pageHref(page - 1)} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black shadow-sm hover:border-pink-300 hover:text-pink-600"><ArrowLeft size={15} /> 前へ</Link> : <span />}
              <span className="text-sm font-bold text-slate-500">{page} / {totalPages}</span>
              {page < totalPages ? <Link href={pageHref(page + 1)} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black shadow-sm hover:border-pink-300 hover:text-pink-600">次へ <ArrowRight size={15} /></Link> : <span />}
            </nav>
          )}
        </section>
      </main>
    </>
  );
}
