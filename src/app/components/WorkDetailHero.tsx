"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, ImageIcon, PlayCircle } from "lucide-react";
import type { Work } from "@/types/work";
import type { PriceHistoryItem } from "@/types/price";
import ImageViewer from "./ImageViewer";
import ActressTags from "./ActressTags";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import AffiliateLink from "./AffiliateLink";
import PriceChartTabs from "./PriceChartTabs";
import PriceAlertButton from "./PriceAlertButton";
import { getSampleMovieFallbackCopy } from "@/lib/sampleMovieFallback";
import { isOfficialSampleMovieUrl } from "@/lib/officialSampleMovie";

type Props = {
  work: Work;
  sampleImages: { image_url: string; sort_order: number }[];
  sampleMovieUrl?: string | null;
  officialSampleEmbedUrl?: string | null;
  priceHistory: PriceHistoryItem[];
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

export default function WorkDetailHero({ work, sampleImages, sampleMovieUrl, officialSampleEmbedUrl, priceHistory, displayPrice, regularPrice, discountRate }: Props) {
  const playableMovieUrl = isOfficialSampleMovieUrl(sampleMovieUrl) ? sampleMovieUrl : null;
  const officialWorkUrl = work.affiliate_url ?? work.url;
  const sampleFallback = getSampleMovieFallbackCopy(work);
  const hasSampleDestination = Boolean(playableMovieUrl || officialSampleEmbedUrl || officialWorkUrl);
  const genres = work.genre?.split(/\s*\/\s*/).map((name) => name.trim()).filter(Boolean) ?? [];
  const [selected, setSelected] = useState<"movie" | number>("movie");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [preferNativeSamplePlayer, setPreferNativeSamplePlayer] = useState(false);
  const officialPlayerRef = useRef<HTMLDivElement>(null);
  const [officialPlayerSize, setOfficialPlayerSize] = useState({ width: 260, height: 167 });
  const showImage = selected !== "movie";
  const compactOfficialSampleEmbedUrl = officialSampleEmbedUrl
    ?.replace(/width=\d+/, `width=${officialPlayerSize.width}`)
    .replace(/height=\d+/, `height=${officialPlayerSize.height}`);

  useEffect(() => {
    const updatePlayerPreference = () => {
      setPreferNativeSamplePlayer(
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(max-width: 767px)").matches ||
        navigator.maxTouchPoints > 0,
      );
    };
    updatePlayerPreference();
    window.addEventListener("resize", updatePlayerPreference);
    return () => window.removeEventListener("resize", updatePlayerPreference);
  }, []);

  useLayoutEffect(() => {
    const player = officialPlayerRef.current;
    if (!player || !officialSampleEmbedUrl) return;
    const updatePlayerSize = () => {
      const width = Math.max(260, Math.round(player.getBoundingClientRect().width));
      const height = Math.round((width * 167) / 260);
      setOfficialPlayerSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    updatePlayerSize();
    const observer = new ResizeObserver(updatePlayerSize);
    observer.observe(player);
    return () => observer.disconnect();
  }, [officialSampleEmbedUrl]);
  const currentLabel = displayPrice != null && displayPrice > 0 ? `¥${displayPrice.toLocaleString("ja-JP")}` : "価格未取得";
  const hasDiscount = Boolean(displayPrice && regularPrice && regularPrice > displayPrice);
  const priceCheckedAt = formatDate(priceHistory[0]?.changed_at);
  const isCurrentLowest = Boolean(displayPrice && work.lowest_price && displayPrice <= work.lowest_price) || work.is_bottom_price;
  const durationLabel = formatDuration(work.duration);
  const priceStatus = hasDiscount
    ? `現在セール中：通常${regularPrice?.toLocaleString("ja-JP")}円が${displayPrice?.toLocaleString("ja-JP")}円（${discountRate}%OFF）`
    : displayPrice && displayPrice > 0
      ? `現在価格：${displayPrice.toLocaleString("ja-JP")}円`
      : "現在価格は未取得です";
  const lowestStatus = isCurrentLowest
    ? `現在価格${displayPrice?.toLocaleString("ja-JP")}円は、発掘LABの記録上の最安値です。`
    : work.lowest_price && work.lowest_price > 0
      ? `発掘LABの記録上の最安値は${work.lowest_price.toLocaleString("ja-JP")}円です。`
      : "過去最安値はまだ確認できていません。";
  const workSummary = [
    priceStatus,
    `発掘LABでの価格取得日：${priceCheckedAt}`,
    lowestStatus,
    durationLabel ? `収録時間は${durationLabel}。` : null,
  ].filter(Boolean).join("\n");

  return <section className="grid gap-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:gap-8">
    <div className="min-w-0 lg:hidden">
      <div className="mb-2 inline-flex rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{work.product_id}</div>
      <h1 className="work-detail-title text-[20px] font-black leading-[1.375] text-slate-950">{work.title}</h1>
    </div>
    <div className="min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-zinc-950 shadow-lg">
        {discountRate > 0 && <div className="absolute left-3 top-3 z-10 rounded-lg bg-pink-600 px-3 py-1 text-xs font-black text-white shadow">{discountRate}%OFF</div>}
        {!showImage && !preferNativeSamplePlayer && compactOfficialSampleEmbedUrl ? <div ref={officialPlayerRef} className="relative h-full w-full overflow-hidden"><iframe key={compactOfficialSampleEmbedUrl} src={compactOfficialSampleEmbedUrl} title={`${work.title} 公式無料サンプル動画`} className="absolute inset-0 h-full w-full border-0" scrolling="no" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : playableMovieUrl && !showImage ? <video key={playableMovieUrl} controls playsInline preload="metadata" poster={work.image_url ?? undefined} className="h-full w-full object-contain" aria-label={`${work.title} 公式無料サンプル動画`}><source src={playableMovieUrl} type="video/mp4" /></video> : showImage ? <button type="button" onClick={() => setViewerOpen(true)} className="relative block h-full w-full cursor-zoom-in" aria-label={`${work.title}のサンプル画像${selected + 1}を拡大する`}><Image src={sampleImages[selected].image_url} alt={work.title} fill sizes="(max-width: 1024px) 100vw, 720px" className="object-contain" /><span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">{selected + 1} / {sampleImages.length}</span></button> : <div className="relative h-full w-full"><Image src={work.image_url ?? ""} alt={work.title} fill sizes="(max-width: 1024px) 100vw, 720px" className="bg-white object-contain" />{officialWorkUrl ? <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-4 pt-12"><AffiliateLink href={officialWorkUrl} workId={work.id} placement="sample-movie-fallback" sourcePage="direct" deliveryMode={sampleFallback.deliveryMode} ariaLabel={`${work.title}のサンプルをFANZA公式で確認する`} className="flex min-h-11 max-w-lg items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-center text-sm font-black text-zinc-900 shadow-lg hover:bg-pink-50"><PlayCircle size={20} className="shrink-0 text-pink-600" /><span>{sampleFallback.label}</span><ExternalLink size={15} className="shrink-0 text-zinc-500" /></AffiliateLink></div> : <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white"><ImageIcon size={13} />作品画像</div>}</div>}
      </div>
      <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="動画・画像サムネイル">
        <button type="button" onClick={() => setSelected("movie")} aria-label="サンプル動画または作品画像を表示" aria-pressed={selected === "movie"} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === "movie" ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}><Image src={work.image_url ?? ""} alt="" fill sizes="96px" className="object-cover" />{hasSampleDestination && <span className="absolute inset-0 flex items-center justify-center bg-black/30"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black"><PlayCircle size={20} /></span></span>}</button>
        {sampleImages.map((image, index) => <button key={image.sort_order} type="button" onClick={() => setSelected(index)} aria-label={`サンプル画像${index + 1}を表示`} aria-pressed={selected === index} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === index ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}><Image src={image.image_url} alt="" fill sizes="96px" className="object-cover" /></button>)}
      </div>
      {selected === "movie" && !playableMovieUrl && !officialSampleEmbedUrl && officialWorkUrl && <p className="mt-1 text-center text-[11px] font-medium leading-5 text-zinc-500">{sampleFallback.note}</p>}
      {viewerOpen && selected !== "movie" && <ImageViewer images={sampleImages} current={selected} onClose={() => setViewerOpen(false)} onPrev={() => setSelected(selected === 0 ? sampleImages.length - 1 : selected - 1)} onNext={() => setSelected((selected + 1) % sampleImages.length)} />}
    </div>

    <div className="min-w-0">
      <h1 className="work-detail-title hidden text-[20px] font-black leading-[1.375] text-slate-950 lg:block">{work.title}</h1>
      <div className="mt-5 border-y border-slate-200 py-4">
        <div className="flex items-end gap-3"><strong className="text-[48px] font-black leading-none text-pink-600">{currentLabel}</strong>{hasDiscount && <><span className="text-sm text-slate-400 line-through">¥{regularPrice?.toLocaleString("ja-JP")}</span><span className="rounded bg-pink-100 px-2 py-1 text-xs font-black text-pink-700">{discountRate}%OFF</span></>}</div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500"><span>発売日：<strong className="text-slate-800">{formatDate(work.release_date)}</strong></span>{durationLabel && <span>{durationLabel}</span>}<span>レビュー：<strong className="text-slate-800">★ {work.review_average > 0 ? work.review_average.toFixed(1) : "—"}（{work.review_count ?? 0}件）</strong></span></div>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{workSummary}</p>
      <div className="mt-6 mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {priceHistory.length > 0 ? <PriceChartTabs history={priceHistory} /> : <p className="py-8 text-center text-sm text-slate-500">価格推移はまだありません。</p>}
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
