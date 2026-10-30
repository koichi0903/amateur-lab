"use client";

import Link from "next/link";
import type { Work } from "@/types/work";
import type { PriceHistoryItem } from "@/types/price";
import ActressTags from "./ActressTags";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import AffiliateLink from "./AffiliateLink";
import PriceAlertButton from "./PriceAlertButton";
import WorkDetailMediaGallery from "./WorkDetailMediaGallery";
import WorkDetailPriceHistory from "./WorkDetailPriceHistory";
import { useWorkDetailPriceSeries } from "./useWorkDetailPriceSeries";
import { buildWorkDetailPriceFacts } from "@/lib/workDetailPriceFacts";

type Props = {
  work: Work;
  sampleImages: { image_url: string; sort_order: number }[];
  sampleMovieUrl?: string | null;
  officialSampleEmbedUrl?: string | null;
  priceHistory: PriceHistoryItem[];
  defaultPriceSeries?: { displayName: string; period: string | null } | null;
  displayPrice: number | null;
  regularPrice: number | null;
  discountRate: number;
};

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10).replace(/-/g, "/") : "—";
}

function formatDuration(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return `${value}分`;
  if (typeof value !== "string" || !value.trim()) return null;
  const hours = value.match(/(\d+)\s*時間/)?.[1];
  const minutes = value.match(/(\d+)\s*分/)?.[1];
  if (hours || minutes) return `${hours ? `${hours}時間` : ""}${minutes ? `${minutes}分` : ""}`;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric}分` : null;
}

export default function WorkDetailHero({ work, sampleImages, sampleMovieUrl, officialSampleEmbedUrl, priceHistory, defaultPriceSeries, displayPrice, regularPrice, discountRate }: Props) {
  const genres = work.genre?.split(/\s*\/\s*/).map((name) => name.trim()).filter(Boolean) ?? [];
  const {
    activeSeriesKey: activePriceSeriesKey,
    setSelectedSeriesKey: setSelectedPriceSeriesKey,
    summary: selectedPriceSummary,
  } = useWorkDetailPriceSeries(priceHistory, displayPrice, defaultPriceSeries);

  const durationLabel = formatDuration(work.duration);
  const { currentLabel, hasDiscount, workSummary } = buildWorkDetailPriceFacts({
    displayPrice,
    regularPrice,
    discountRate,
    history: priceHistory,
    selectedSummary: selectedPriceSummary,
    durationLabel,
  });

  return <section className="grid gap-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:gap-8">
    <div className="min-w-0 lg:hidden">
      <div className="mb-2 inline-flex rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{work.product_id}</div>
      <h1 className="work-detail-title text-[20px] font-black leading-[1.375] text-slate-950">{work.title}</h1>
    </div>
    <WorkDetailMediaGallery
      work={work}
      sampleImages={sampleImages}
      sampleMovieUrl={sampleMovieUrl}
      officialSampleEmbedUrl={officialSampleEmbedUrl}
      discountRate={discountRate}
    />
    <div className="min-w-0">
      <h1 className="work-detail-title hidden text-[20px] font-black leading-[1.375] text-slate-950 lg:block">{work.title}</h1>
      <div className="mt-5 border-y border-slate-200 py-4">
        <div className="mb-1 text-xs font-semibold text-slate-500">現在の代表価格</div>
        <div className="flex items-end gap-3"><strong className="text-[48px] font-black leading-none text-pink-600">{currentLabel}</strong>{hasDiscount && <><span className="text-sm text-slate-400 line-through">¥{regularPrice?.toLocaleString("ja-JP")}</span><span className="rounded bg-pink-100 px-2 py-1 text-xs font-black text-pink-700">{discountRate}%OFF</span></>}</div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500"><span>発売日：<strong className="text-slate-800">{formatDate(work.release_date)}</strong></span>{durationLabel && <span>{durationLabel}</span>}<span>レビュー：<strong className="text-slate-800">★ {work.review_average > 0 ? work.review_average.toFixed(1) : "—"}（{work.review_count ?? 0}件）</strong></span></div>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{workSummary}</p>
      <div className="mt-6 mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <WorkDetailPriceHistory
          history={priceHistory}
          selectedSummary={selectedPriceSummary}
          selectedSeriesKey={activePriceSeriesKey}
          onSelectedSeriesChange={setSelectedPriceSeriesKey}
        />
      </div>
      <div className="flex items-stretch gap-2">
        {work.affiliate_url ? <AffiliateLink href={work.affiliate_url} workId={work.id} placement="detail-sidebar" sourcePage="direct" className="flex h-14 min-w-0 flex-1 items-center justify-center rounded-lg bg-pink-600 px-3 text-base font-bold text-white shadow-sm hover:bg-pink-700">FANZAで見る{displayPrice ? `（${currentLabel}）` : ""}</AffiliateLink> : <span className="flex h-14 min-w-0 flex-1 items-center justify-center rounded-lg bg-slate-100 px-3 text-base font-bold text-slate-400">FANZAリンク準備中</span>}
        <FavoriteButton workId={work.id} iconOnly className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-2xl leading-none text-slate-600 transition hover:border-pink-200 hover:bg-pink-50" />
      </div>
      <PriceAlertButton workId={work.id} workTitle={work.title} actress={work.actress} maker={work.maker} />
      <div className="mt-5 flex min-w-0 flex-wrap gap-2 border-t border-slate-200 pt-4">{work.actress && <ActressTags actress={work.actress} />}{work.maker && <Link href={`/maker/${encodeURIComponent(work.maker)}`} className="max-w-full break-words rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">🏢 {work.maker}</Link>}{genres.map((genre, index) => <Link key={`${genre}-${index}`} href={`/genre/${encodeURIComponent(genre)}`} className="max-w-full break-words rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">🏷 {genre}</Link>)}</div>
    </div>
  </section>;
}
