"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Work } from "@/types/work";
import ImageViewer from "./ImageViewer";
import ActressTags from "./ActressTags";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { ExternalLink, ImageIcon, PlayCircle } from "lucide-react";
import AffiliateLink from "./AffiliateLink";
import type { AffiliateSource } from "@/lib/affiliateTracking";
import { parseDatabaseDate } from "@/lib/dateTime";
import { getSampleMovieFallbackCopy } from "@/lib/sampleMovieFallback";
import { isOfficialSampleMovieUrl } from "@/lib/officialSampleMovie";

type Props = {
  work: Work;
  sampleImages: { image_url: string; sort_order: number }[];
  sampleMovieUrl?: string | null;
  sourcePage?: AffiliateSource;
};

export default function WorkHero({ work, sampleImages, sampleMovieUrl, sourcePage }: Props) {
  // Detail pages can play the official URL directly. The X posting rights gate
  // remains isolated in the X workflow and is intentionally not used here.
  const playableMovieUrl = isOfficialSampleMovieUrl(sampleMovieUrl) ? sampleMovieUrl : null;
  // eslint-disable-next-line react-hooks/purity
  const saleActive = !work.sale_end_at || (parseDatabaseDate(work.sale_end_at)?.getTime() ?? 0) > Date.now();
  const genres = work.genre?.split(/\s*\/\s*/).map((name) => name.trim()).filter(Boolean) ?? [];
  const officialWorkUrl = work.affiliate_url ?? work.url;
  const sampleFallback = getSampleMovieFallbackCopy(work);
  const hasSampleDestination = Boolean(playableMovieUrl || officialWorkUrl);
  const hasValidRanking = typeof work.ranking === "number" && work.ranking > 0 && work.ranking < 9999;
  const [selected, setSelected] = useState<"movie" | number>("movie");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [titleOverflows, setTitleOverflows] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const checkOverflow = () => {
      const width = title.getBoundingClientRect().width;
      if (!width) return;
      const clone = title.cloneNode(true) as HTMLHeadingElement;
      clone.classList.remove("line-clamp-2");
      Object.assign(clone.style, { position: "fixed", left: "-10000px", top: "0", width: `${width}px`, height: "auto", maxHeight: "none", overflow: "visible", visibility: "hidden", pointerEvents: "none" });
      document.body.appendChild(clone);
      const lineHeight = Number.parseFloat(window.getComputedStyle(clone).lineHeight);
      setTitleOverflows(clone.getBoundingClientRect().height > lineHeight * 2 + 1);
      clone.remove();
    };
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(title);
    return () => observer.disconnect();
  }, [work.title]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (viewerOpen) return;
      if (event.key === "ArrowRight") setSelected((current) => current === "movie" ? (sampleImages.length ? 0 : "movie") : current < sampleImages.length - 1 ? current + 1 : "movie");
      if (event.key === "ArrowLeft") setSelected((current) => current === "movie" ? (sampleImages.length ? sampleImages.length - 1 : "movie") : current > 0 ? current - 1 : "movie");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sampleImages.length, viewerOpen]);

  const showImage = selected !== "movie";

  return (
    <div className="min-w-0">
      <div className="relative min-w-0">
        <h1 ref={titleRef} className={`${titleExpanded ? "" : "line-clamp-2"} min-w-0 break-words text-2xl font-black leading-tight tracking-tight text-zinc-900 sm:text-3xl lg:text-[38px] lg:leading-[1.15]`}>{work.title}</h1>
        {!titleExpanded && titleOverflows && <button type="button" aria-expanded="false" onClick={() => setTitleExpanded(true)} className="absolute bottom-0 right-0 bg-gradient-to-l from-white from-80% via-white via-80% to-transparent pl-8 text-sm font-bold leading-[2rem] text-pink-600 hover:text-pink-700 sm:text-base lg:leading-[2.75rem]">…さらに表示</button>}
        {titleExpanded && titleOverflows && <button type="button" aria-expanded="true" onClick={() => setTitleExpanded(false)} className="mt-2 text-sm font-bold text-pink-600 hover:text-pink-700 sm:text-base">折りたたむ</button>}
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {work.actress && <ActressTags actress={work.actress} />}
        {work.maker && <Link href={`/maker/${encodeURIComponent(work.maker)}`} className="max-w-full break-words rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold leading-5 text-green-700 transition hover:bg-green-200">🏢 {work.maker}</Link>}
        {work.series && <Link href={`/series/${encodeURIComponent(work.series)}`} className="max-w-full break-words rounded-full bg-yellow-100 px-4 py-1.5 text-sm font-semibold leading-5 text-yellow-700 transition hover:bg-yellow-200">📚 {work.series}</Link>}
        {genres.map((genre, index) => <Link key={`${genre}-${index}`} href={`/genre/${encodeURIComponent(genre)}`} className="max-w-full break-words rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold leading-5 text-indigo-700 transition hover:bg-indigo-200">🏷 {genre}</Link>)}
      </div>

      <div className="mt-8">
        <div className="relative mx-auto aspect-video w-full max-h-[min(68vw,680px)] overflow-hidden rounded-2xl border bg-zinc-950 shadow-lg">
          {work.discount_rate > 0 && <div className="absolute left-3 top-3 z-10 rounded-lg bg-pink-600 px-3 py-1 text-xs font-black text-white shadow">{work.discount_rate}%OFF</div>}
          {playableMovieUrl && !showImage ? <video key={playableMovieUrl} controls playsInline preload="metadata" poster={work.image_url ?? undefined} className="h-full w-full object-contain" aria-label={`${work.title} 公式無料サンプル動画`}><source src={playableMovieUrl} type="video/mp4" /></video> : showImage ? <button type="button" onClick={() => setViewerOpen(true)} className="relative block h-full w-full cursor-zoom-in" aria-label={`${work.title}のサンプル画像${selected + 1}を拡大する`}><Image src={sampleImages[selected].image_url} alt={work.title} fill sizes="(max-width: 768px) 100vw, 1100px" className="object-contain" /><span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">{selected + 1} / {sampleImages.length}</span></button> : <div className="relative h-full w-full"><Image src={work.image_url ?? ""} alt={work.title} fill sizes="(max-width: 768px) 100vw, 1100px" className="bg-white object-contain" />{officialWorkUrl ? <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-4 pt-12"><AffiliateLink href={officialWorkUrl} workId={work.id} placement="sample-movie-fallback" sourcePage={sourcePage} deliveryMode={sampleFallback.deliveryMode} ariaLabel={`${work.title}のサンプルをFANZA公式で確認する`} className="flex min-h-11 max-w-lg items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-center text-sm font-black text-zinc-900 shadow-lg hover:bg-pink-50"><PlayCircle aria-hidden="true" size={20} className="shrink-0 text-pink-600" /><span>{sampleFallback.label}</span><ExternalLink aria-hidden="true" size={15} className="shrink-0 text-zinc-500" /></AffiliateLink></div> : <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white"><ImageIcon aria-hidden="true" size={13} />作品画像</div>}</div>}
        </div>

        <div className="mt-4 flex min-w-0 gap-3 overflow-x-auto pb-2" aria-label="動画・画像サムネイル">
          <button type="button" onClick={() => setSelected("movie")} aria-label={hasSampleDestination ? "サンプル動画を表示" : "作品画像を表示"} aria-pressed={selected === "movie"} className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 transition ${selected === "movie" ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}><Image src={work.image_url ?? ""} alt="" fill sizes="112px" className="object-cover" />{hasSampleDestination && <span className="absolute inset-0 flex items-center justify-center bg-black/30"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black"><PlayCircle aria-hidden="true" size={23} /></span></span>}</button>
          {sampleImages.map((image, index) => <button key={image.sort_order} type="button" onClick={() => setSelected(index)} aria-label={`サンプル画像${index + 1}を表示`} aria-pressed={selected === index} className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 transition ${selected === index ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}><Image src={image.image_url} alt="" fill sizes="112px" className="object-cover" /></button>)}
        </div>
        {selected === "movie" && !playableMovieUrl && officialWorkUrl && <p className="mt-1 text-center text-[11px] font-medium leading-5 text-zinc-500">{sampleFallback.note}</p>}
      </div>

      <div className="mt-8 rounded-3xl border bg-white p-4 md:p-6"><div className="grid grid-cols-2 gap-y-5">
        <div><div className="text-xs text-zinc-400">発売日</div><div className="font-bold">{work.release_date}</div></div>
        <div><div className="text-xs text-zinc-400">ランキング</div><div className="font-bold">{hasValidRanking ? `${work.ranking}位` : "---"}</div></div>
        <div><div className="text-xs text-zinc-400">レビュー</div><div className="font-bold">⭐ {work.review_average}</div></div>
        <div><div className="text-xs text-zinc-400">件数</div><div className="font-bold">{work.review_count}件</div></div>
        <div><div className="text-xs text-zinc-400">価格</div><div className="font-black text-pink-600">¥{(saleActive && work.sale_price ? work.sale_price : work.price).toLocaleString()}</div></div>
        <div><div className="text-xs text-zinc-400">メーカー</div><div className="font-bold">{work.maker}</div></div>
      </div></div>

      <FavoriteButton workId={work.id} className="mt-4 flex h-11 w-full items-center justify-center rounded-full border bg-white text-sm font-semibold shadow-sm transition hover:bg-pink-50" />
      {viewerOpen && selected !== "movie" && <ImageViewer images={sampleImages} current={selected} onClose={() => setViewerOpen(false)} onPrev={() => setSelected(selected === 0 ? sampleImages.length - 1 : selected - 1)} onNext={() => setSelected((selected + 1) % sampleImages.length)} />}
    </div>
  );
}
