"use client";

import Image from "next/image";
import { useState } from "react";
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
      {selected !== null && sampleImages[selected] ? (
        <Image src={sampleImages[selected]} alt={`${title}のサンプル画像 ${selected + 1}`} fill priority sizes="(max-width: 1024px) 100vw, 720px" unoptimized className="object-contain" />
      ) : preferNativeSamplePlayer && playableMovieUrl ? (
        <video key={playableMovieUrl} autoPlay muted controls playsInline preload="metadata" poster={coverUrl ?? undefined} className="h-full w-full object-contain" aria-label={`${title}の公式サンプル動画`}><source src={playableMovieUrl} type="video/mp4" /></video>
      ) : compactOfficialSampleEmbedUrl ? (
        <div ref={officialPlayerRef} className="relative h-full w-full overflow-hidden">
          <iframe key={compactOfficialSampleEmbedUrl} src={compactOfficialSampleEmbedUrl} title={`${title}の公式サンプル動画`} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
        </div>
      ) : playableMovieUrl ? (
        <video key={playableMovieUrl} autoPlay muted controls playsInline preload="metadata" poster={coverUrl ?? undefined} className="h-full w-full object-contain" aria-label={`${title}の公式サンプル動画`}><source src={playableMovieUrl} type="video/mp4" /></video>
      ) : coverUrl ? (
        <Image src={coverUrl} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 720px" unoptimized className="bg-white object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm font-bold text-white">作品画像・サンプルは未取得です</div>
      )}
      {discount > 0 && <span className="absolute left-3 top-3 rounded-lg bg-pink-600 px-3 py-1 text-xs font-black text-white shadow">{discount}%OFF</span>}
      {selected !== null && <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">{selected + 1} / {sampleImages.length}</span>}
    </div>
    {(coverUrl || sampleImages.length > 0) && <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="動画・画像サムネイル">
      {coverUrl && <button type="button" onClick={() => setSelected(null)} aria-label="公式サンプルまたは作品画像を表示" aria-pressed={selected === null} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === null ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}>
        <Image src={coverUrl} alt="" fill sizes="96px" unoptimized className="object-cover" />
        {samplePlayerAvailable && <span className="absolute inset-0 flex items-center justify-center bg-black/30"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xs font-black text-black">▶</span></span>}
      </button>}
      {sampleImages.map((src, index) => <button key={src} type="button" onClick={() => setSelected(index)} aria-label={`サンプル画像${index + 1}を表示`} aria-pressed={selected === index} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === index ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}>
        <Image src={src} alt="" fill sizes="96px" unoptimized className="object-cover" />
      </button>)}
    </div>}
  </div>;
}
