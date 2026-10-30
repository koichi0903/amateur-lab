"use client";

import Image from "next/image";
import { useState } from "react";
import { ExternalLink, ImageIcon, PlayCircle } from "lucide-react";
import type { Work } from "@/types/work";
import ImageViewer from "./ImageViewer";
import AffiliateLink from "./AffiliateLink";
import { usePreferNativeSamplePlayer } from "@/components/usePreferNativeSamplePlayer";
import { useOfficialSampleEmbedSize } from "@/components/useOfficialSampleEmbedSize";
import { getSampleMovieFallbackCopy } from "@/lib/sampleMovieFallback";
import { isOfficialSampleMovieUrl } from "@/lib/officialSampleMovie";

type Props = {
  work: Work;
  sampleImages: { image_url: string; sort_order: number }[];
  sampleMovieUrl?: string | null;
  officialSampleEmbedUrl?: string | null;
  discountRate: number;
};

type StageProps = Props & {
  selected: "movie" | number;
  playableMovieUrl: string | null;
  preferNativeSamplePlayer: boolean;
  compactOfficialSampleEmbedUrl?: string;
  officialPlayerRef: React.RefObject<HTMLDivElement | null>;
  officialWorkUrl: string | null;
  sampleFallback: ReturnType<typeof getSampleMovieFallbackCopy>;
  onOpenViewer: () => void;
};

function SampleStage({
  work,
  sampleImages,
  discountRate,
  selected,
  playableMovieUrl,
  preferNativeSamplePlayer,
  compactOfficialSampleEmbedUrl,
  officialPlayerRef,
  officialWorkUrl,
  sampleFallback,
  onOpenViewer,
}: StageProps) {
  const showImage = selected !== "movie";

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-zinc-950 shadow-lg">
      {discountRate > 0 && (
        <div className="absolute left-3 top-3 z-10 rounded-lg bg-pink-600 px-3 py-1 text-xs font-black text-white shadow">
          {discountRate}%OFF
        </div>
      )}
      {!showImage && !preferNativeSamplePlayer && compactOfficialSampleEmbedUrl ? (
        <div ref={officialPlayerRef} className="relative h-full w-full overflow-hidden">
          <iframe
            key={compactOfficialSampleEmbedUrl}
            src={compactOfficialSampleEmbedUrl}
            title={`${work.title} 公式無料サンプル動画`}
            className="absolute inset-0 h-full w-full border-0"
            scrolling="no"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : playableMovieUrl && !showImage ? (
        <video
          key={playableMovieUrl}
          controls
          playsInline
          preload="metadata"
          poster={work.image_url ?? undefined}
          className="h-full w-full object-contain"
          aria-label={`${work.title} 公式無料サンプル動画`}
        >
          <source src={playableMovieUrl} type="video/mp4" />
        </video>
      ) : showImage ? (
        <button
          type="button"
          onClick={onOpenViewer}
          className="relative block h-full w-full cursor-zoom-in"
          aria-label={`${work.title}のサンプル画像${selected + 1}を拡大する`}
        >
          <Image
            src={sampleImages[selected].image_url}
            alt={work.title}
            fill
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-contain"
          />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
            {selected + 1} / {sampleImages.length}
          </span>
        </button>
      ) : (
        <div className="relative h-full w-full">
          <Image
            src={work.image_url ?? ""}
            alt={work.title}
            fill
            sizes="(max-width: 1024px) 100vw, 720px"
            className="bg-white object-contain"
          />
          {officialWorkUrl ? (
            <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-4 pt-12">
              <AffiliateLink
                href={officialWorkUrl}
                workId={work.id}
                placement="sample-movie-fallback"
                sourcePage="direct"
                deliveryMode={sampleFallback.deliveryMode}
                ariaLabel={`${work.title}のサンプルをFANZA公式で確認する`}
                className="flex min-h-11 max-w-lg items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-center text-sm font-black text-zinc-900 shadow-lg hover:bg-pink-50"
              >
                <PlayCircle size={20} className="shrink-0 text-pink-600" />
                <span>{sampleFallback.label}</span>
                <ExternalLink size={15} className="shrink-0 text-zinc-500" />
              </AffiliateLink>
            </div>
          ) : (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
              <ImageIcon size={13} />作品画像
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SampleThumbnails({
  work,
  sampleImages,
  selected,
  hasSampleDestination,
  onSelect,
}: {
  work: Work;
  sampleImages: Props["sampleImages"];
  selected: "movie" | number;
  hasSampleDestination: boolean;
  onSelect: (value: "movie" | number) => void;
}) {
  return (
    <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="動画・画像サムネイル">
      <button
        type="button"
        onClick={() => onSelect("movie")}
        aria-label="サンプル動画または作品画像を表示"
        aria-pressed={selected === "movie"}
        className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === "movie" ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}
      >
        <Image src={work.image_url ?? ""} alt="" fill sizes="96px" className="object-cover" />
        {hasSampleDestination && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black">
              <PlayCircle size={20} />
            </span>
          </span>
        )}
      </button>
      {sampleImages.map((image, index) => (
        <button
          key={image.sort_order}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`サンプル画像${index + 1}を表示`}
          aria-pressed={selected === index}
          className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${selected === index ? "border-pink-500 ring-2 ring-pink-300" : "border-zinc-300"}`}
        >
          <Image src={image.image_url} alt="" fill sizes="96px" className="object-cover" />
        </button>
      ))}
    </div>
  );
}

export default function WorkDetailMediaGallery({
  work,
  sampleImages,
  sampleMovieUrl,
  officialSampleEmbedUrl,
  discountRate,
}: Props) {
  const [selected, setSelected] = useState<"movie" | number>("movie");
  const [viewerOpen, setViewerOpen] = useState(false);
  const playableMovieUrl = isOfficialSampleMovieUrl(sampleMovieUrl)
    ? sampleMovieUrl ?? null
    : null;
  const officialWorkUrl = work.affiliate_url ?? work.url;
  const sampleFallback = getSampleMovieFallbackCopy(work);
  const hasSampleDestination = Boolean(
    playableMovieUrl || officialSampleEmbedUrl || officialWorkUrl,
  );
  const { officialPlayerRef, compactOfficialSampleEmbedUrl } =
    useOfficialSampleEmbedSize(officialSampleEmbedUrl ?? null);
  const preferNativeSamplePlayer = usePreferNativeSamplePlayer();

  return (
    <div className="min-w-0">
      <SampleStage
        work={work}
        sampleImages={sampleImages}
        discountRate={discountRate}
        selected={selected}
        playableMovieUrl={playableMovieUrl}
        preferNativeSamplePlayer={preferNativeSamplePlayer}
        compactOfficialSampleEmbedUrl={compactOfficialSampleEmbedUrl}
        officialPlayerRef={officialPlayerRef}
        officialWorkUrl={officialWorkUrl}
        sampleFallback={sampleFallback}
        onOpenViewer={() => setViewerOpen(true)}
      />
      <SampleThumbnails
        work={work}
        sampleImages={sampleImages}
        selected={selected}
        hasSampleDestination={hasSampleDestination}
        onSelect={setSelected}
      />
      {selected === "movie" &&
        !playableMovieUrl &&
        !officialSampleEmbedUrl &&
        officialWorkUrl && (
          <p className="mt-1 text-center text-[11px] font-medium leading-5 text-zinc-500">
            {sampleFallback.note}
          </p>
        )}
      {viewerOpen && selected !== "movie" && (
        <ImageViewer
          images={sampleImages}
          current={selected}
          onClose={() => setViewerOpen(false)}
          onPrev={() =>
            setSelected(selected === 0 ? sampleImages.length - 1 : selected - 1)
          }
          onNext={() => setSelected((selected + 1) % sampleImages.length)}
        />
      )}
    </div>
  );
}
