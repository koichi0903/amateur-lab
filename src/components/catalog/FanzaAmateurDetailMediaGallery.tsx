"use client";

import Image from "next/image";
import { useState, type RefObject } from "react";
import { usePreferNativeSamplePlayer } from "@/components/usePreferNativeSamplePlayer";
import { useOfficialSampleEmbedSize } from "@/components/useOfficialSampleEmbedSize";

function isOfficialMp4(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && url.pathname.toLowerCase().endsWith(".mp4") &&
      ["dmm.co.jp", "dmm.com", "fanza.co.jp"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function PrimaryMedia({
  title,
  coverUrl,
  selected,
  sampleImages,
  playableMovieUrl,
  preferNativeSamplePlayer,
  compactOfficialSampleEmbedUrl,
  officialPlayerRef,
}: {
  title: string;
  coverUrl: string | null | undefined;
  selected: number | null;
  sampleImages: string[];
  playableMovieUrl: string | null;
  preferNativeSamplePlayer: boolean;
  compactOfficialSampleEmbedUrl: string | null | undefined;
  officialPlayerRef: RefObject<HTMLDivElement | null>;
}) {
  if (selected !== null && sampleImages[selected]) {
    return <Image src={sampleImages[selected]} alt={`${title}のサンプル画像 ${selected + 1}`} fill priority sizes="(max-width: 1024px) 100vw, 720px" unoptimized className="object-contain" />;
  }
  if (preferNativeSamplePlayer && playableMovieUrl) {
    return <OfficialSampleVideo title={title} url={playableMovieUrl} poster={coverUrl} />;
  }
  if (compactOfficialSampleEmbedUrl) {
    return <div ref={officialPlayerRef} className="relative h-full w-full overflow-hidden">
      <iframe key={compactOfficialSampleEmbedUrl} src={compactOfficialSampleEmbedUrl} title={`${title}の公式サンプル動画`} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
    </div>;
  }
  if (playableMovieUrl) return <OfficialSampleVideo title={title} url={playableMovieUrl} poster={coverUrl} />;
  if (coverUrl) return <Image src={coverUrl} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 720px" unoptimized className="bg-white object-contain" />;
  return <div className="flex h-full items-center justify-center text-sm font-bold text-white">作品画像・サンプルは未取得です</div>;
}

function OfficialSampleVideo({ title, url, poster }: { title: string; url: string; poster: string | null | undefined }) {
  return <video key={url} autoPlay muted controls playsInline preload="metadata" poster={poster ?? undefined} className="h-full w-full object-contain" aria-label={`${title}の公式サンプル動画`}><source src={url} type="video/mp4" /></video>;
}

function GalleryThumbnails({
  coverUrl,
  sampleImages,
  selected,
  samplePlayerAvailable,
  onSelect,
}: {
  coverUrl: string | null | undefined;
  sampleImages: string[];
  selected: number | null;
  samplePlayerAvailable: boolean;
  onSelect: (index: number | null) => void;
}) {
  if (!coverUrl && sampleImages.length === 0) return null;

  return <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="動画・画像サムネイル">
    {coverUrl && <button type="button" onClick={() => onSelect(null)} aria-label="公式サンプルまたは作品画像を表示" aria-pressed={selected === null} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === null ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}>
      <Image src={coverUrl} alt="" fill sizes="96px" unoptimized className="object-cover" />
      {samplePlayerAvailable && <span className="absolute inset-0 flex items-center justify-center bg-black/30"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xs font-black text-black">▶</span></span>}
    </button>}
    {sampleImages.map((src, index) => <button key={src} type="button" onClick={() => onSelect(index)} aria-label={`サンプル画像${index + 1}を表示`} aria-pressed={selected === index} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === index ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}>
      <Image src={src} alt="" fill sizes="96px" unoptimized className="object-cover" />
    </button>)}
  </div>;
}

export function FanzaAmateurDetailMediaGallery({
  title,
  coverUrl,
  officialSampleEmbedUrl,
  sampleMovieMp4Url,
  sampleImages,
  discount,
}: {
  title: string;
  coverUrl: string | null | undefined;
  officialSampleEmbedUrl: string | null;
  sampleMovieMp4Url: string | null;
  sampleImages: string[];
  discount: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const playableMovieUrl = isOfficialMp4(sampleMovieMp4Url) ? sampleMovieMp4Url : null;
  const preferNativeSamplePlayer = usePreferNativeSamplePlayer();
  const { officialPlayerRef, compactOfficialSampleEmbedUrl } = useOfficialSampleEmbedSize(officialSampleEmbedUrl);
  const samplePlayerAvailable = Boolean(officialSampleEmbedUrl || playableMovieUrl);

  return <div className="min-w-0">
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-zinc-950 shadow-lg">
      <PrimaryMedia
        title={title}
        coverUrl={coverUrl}
        selected={selected}
        sampleImages={sampleImages}
        playableMovieUrl={playableMovieUrl}
        preferNativeSamplePlayer={preferNativeSamplePlayer}
        compactOfficialSampleEmbedUrl={compactOfficialSampleEmbedUrl}
        officialPlayerRef={officialPlayerRef}
      />
      {discount > 0 && <span className="absolute left-3 top-3 rounded-lg bg-pink-600 px-3 py-1 text-xs font-black text-white shadow">{discount}%OFF</span>}
      {selected !== null && <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">{selected + 1} / {sampleImages.length}</span>}
    </div>
    <GalleryThumbnails coverUrl={coverUrl} sampleImages={sampleImages} selected={selected} samplePlayerAvailable={samplePlayerAvailable} onSelect={setSelected} />
  </div>;
}
