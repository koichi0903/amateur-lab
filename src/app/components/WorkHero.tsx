"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Work } from "@/types/work";
import ImageViewer from "./ImageViewer";
import ActressTags from "./ActressTags";
import FavoriteButton from "@/components/favorites/FavoriteButton";

type Props = {
  work: Work;
  sampleImages: {
    image_url: string;
    sort_order: number;
  }[];
  sampleMovieUrl?: string | null;
};

export default function WorkHero({
  work,
  sampleImages,
  sampleMovieUrl,
}: Props) {

const genres = work.genre
  ?.split(/\s*\/\s*/)
  .map((name) => name.trim())
  .filter(Boolean) ?? [];

const hasValidRanking =
  typeof work.ranking === "number" &&
  work.ranking > 0 &&
  work.ranking < 9999;

const [selected, setSelected] = useState<
  "movie" | number
>("movie");

const [viewerOpen, setViewerOpen] =
  useState(false);

const titleRef = useRef<HTMLHeadingElement>(null);
const [titleExpanded, setTitleExpanded] = useState(false);
const [titleOverflows, setTitleOverflows] = useState(false);

useLayoutEffect(() => {
  const title = titleRef.current;
  if (!title) return;

  const checkOverflow = () => {
    const width = title.getBoundingClientRect().width;
    if (width === 0) return;

    const clone = title.cloneNode(true) as HTMLHeadingElement;
    clone.classList.remove("line-clamp-2");
    clone.style.position = "fixed";
    clone.style.left = "-10000px";
    clone.style.top = "0";
    clone.style.width = `${width}px`;
    clone.style.height = "auto";
    clone.style.maxHeight = "none";
    clone.style.overflow = "visible";
    clone.style.visibility = "hidden";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);

    const lineHeight = Number.parseFloat(
      window.getComputedStyle(clone).lineHeight
    );
    const fullHeight = clone.getBoundingClientRect().height;
    clone.remove();

    setTitleOverflows(fullHeight > lineHeight * 2 + 1);
  };

  checkOverflow();
  const observer = new ResizeObserver(checkOverflow);
  observer.observe(title);

  return () => observer.disconnect();
}, [work.title]);

useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    if (viewerOpen) return;

    if (e.key === "ArrowRight") {
      if (selected === "movie") {
        if (sampleImages.length > 0) {
          setSelected(0);
        }
      } else if (
        selected < sampleImages.length - 1
      ) {
        setSelected(selected + 1);
      } else {
        setSelected("movie");
      }
    }

    if (e.key === "ArrowLeft") {
      if (selected === "movie") {
        if (sampleImages.length > 0) {
          setSelected(
            sampleImages.length - 1
          );
        }
      } else if (selected > 0) {
        setSelected(selected - 1);
      } else {
        setSelected("movie");
      }
    }
  }

  window.addEventListener(
    "keydown",
    handleKey
  );

  return () =>
    window.removeEventListener(
      "keydown",
      handleKey
    );
}, [
  selected,
  sampleImages.length,
  viewerOpen,
]);

  return (
    <div className="grid min-w-0 gap-10 lg:grid-cols-[260px_minmax(0,1fr)] items-start">

      {/* 左カラム */}
<div className="min-w-0 lg:sticky lg:top-6">

  <div className="relative">

    {work.discount_rate > 0 && (
      <div className="absolute left-3 top-3 z-10 rounded-lg bg-pink-600 px-3 py-1 text-xs font-black text-white shadow">
        {work.discount_rate}%OFF
      </div>
    )}

    {selected === "movie" && sampleMovieUrl ? (
  <video
  key={selected}
  controls
  playsInline
  preload="metadata"
  className="w-full rounded-2xl border bg-black shadow-lg"
>
    <source
      src={sampleMovieUrl}
      type="video/mp4"
    />
  </video>
) : (

  <div
  onClick={() => setViewerOpen(true)}
  className="relative cursor-zoom-in"
>
  <Image
  key={
    selected === "movie"
      ? "movie"
      : sampleImages[selected].image_url
  }
  src={
    selected === "movie"
      ? (work.image_url ?? "")
      : sampleImages[selected].image_url
  }
  alt={work.title}
  width={280}
  height={395}
  className="
    w-full
    rounded-2xl
    border
    bg-white
    object-cover
    shadow-lg
    transition-opacity
    duration-300
  "
/>
  <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
  {selected === "movie"
    ? "動画"
    : `${selected + 1} / ${sampleImages.length}`}
</div>

  </div>
)}

  </div>

  <div className="mt-4 flex gap-2 overflow-x-auto">

  <button
  onClick={() => setSelected("movie")}
  className={`
    relative
    h-16
    w-16
    shrink-0
    overflow-hidden
    rounded-xl
    border-2
    transition
    ${
      selected === "movie"
        ? "border-pink-500 ring-2 ring-pink-300"
        : "border-zinc-300"
    }
  `}
>

  <Image
    src={work.image_url ?? ""}
    alt={work.title}
    fill
    sizes="64px"
    className="object-cover"
  />

  <div className="absolute inset-0 flex items-center justify-center bg-black/30">

    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm font-black text-black">

      ▶

    </div>

  </div>

</button>

  {sampleImages.map((image, index) => (
    <Image
      key={image.sort_order}
      src={image.image_url}
      alt=""
      width={64}
      height={64}
      onClick={() => setSelected(index)}
      className={`
  h-16
  w-16
  shrink-0
  cursor-pointer
  rounded-xl
  border-2
  object-cover
  transition
  ${
    selected === index
      ? "border-pink-500 ring-2 ring-pink-300"
      : "border-zinc-300"
  }
`}
    />
  ))}

</div>

  <FavoriteButton
    workId={work.id}
    className="mt-4 flex h-11 w-full items-center justify-center rounded-full border bg-white text-sm font-semibold shadow-sm transition hover:bg-pink-50"
  />

</div>

      {/* 右カラム */}
      <div className="min-w-0">

        <div className="relative min-w-0">
          <h1
            ref={titleRef}
            className={`${titleExpanded ? "" : "line-clamp-2"} min-w-0 break-words text-2xl font-black leading-tight tracking-tight text-zinc-900 sm:text-3xl lg:text-[38px] lg:leading-[1.15]`}
          >
            {work.title}
          </h1>
          {!titleExpanded && titleOverflows && (
            <button
              type="button"
              aria-expanded="false"
              onClick={() => setTitleExpanded(true)}
              className="absolute bottom-0 right-0 bg-gradient-to-l from-white from-80% via-white via-80% to-transparent pl-8 text-sm font-bold leading-[2rem] text-pink-600 hover:text-pink-700 sm:text-base lg:leading-[2.75rem]"
            >
              …さらに表示
            </button>
          )}
          {titleExpanded && titleOverflows && (
            <button
              type="button"
              aria-expanded="true"
              onClick={() => setTitleExpanded(false)}
              className="mt-2 text-sm font-bold text-pink-600 hover:text-pink-700 sm:text-base"
            >
              折りたたむ
            </button>
          )}
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap gap-2">

{work.actress && <ActressTags actress={work.actress} />}

{work.maker && (
  <Link
    href={`/maker/${encodeURIComponent(work.maker)}`}
    className="max-w-full break-words rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold leading-5 text-green-700 transition hover:bg-green-200"
  >
    🏢 {work.maker}
  </Link>
)}

{work.series && (
  <Link
    href={`/series/${encodeURIComponent(work.series)}`}
    className="max-w-full break-words rounded-full bg-yellow-100 px-4 py-1.5 text-sm font-semibold leading-5 text-yellow-700 transition hover:bg-yellow-200"
  >
    📚 {work.series}
  </Link>
)}

{genres.map((genre, index) => (
  <Link
    key={`${genre}-${index}`}
    href={`/genre/${encodeURIComponent(genre)}`}
    className="max-w-full break-words rounded-full bg-indigo-100 px-4 py-1.5 text-[0] font-semibold leading-5 text-indigo-700 transition hover:bg-indigo-200"
  >
    <span aria-hidden="true" className="text-sm">🏷 </span>
    <span className="text-sm">{genre}</span>
  </Link>
))}

</div>

        <div className="mt-8 grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
  {/* 発掘スコア */}
  <div className="flex min-h-36 min-w-0 flex-col justify-center rounded-2xl border bg-white p-3 text-center md:h-[210px] md:rounded-3xl md:p-6">

    <div className="text-xs font-bold text-zinc-500 md:text-sm md:font-normal">
      発掘スコア
    </div>

    <div className="mt-2 text-5xl font-black leading-none text-pink-600 md:mt-3 md:text-6xl">
      {work.score}
    </div>

    <div className="mt-2 text-sm text-zinc-400">
      /100
    </div>

    <div className="mt-3 text-base text-yellow-500 md:mt-4 md:text-xl">
      ★★★★★
    </div>

  </div>

  {/* 総合おすすめ */}
  <div className="flex min-h-36 min-w-0 flex-col justify-center rounded-2xl border bg-white p-3 text-center md:h-[210px] md:rounded-3xl md:p-6">

    <div className="text-xs font-bold text-zinc-500 md:text-sm md:font-normal">
      総合おすすめ度
    </div>

    <div className="mt-3 flex justify-center md:mt-5">

      <div className="flex h-24 w-24 items-center justify-center rounded-full border-8 border-pink-500 md:h-32 md:w-32 md:border-[10px]">

        <div>
          <div className="text-3xl font-black leading-none text-pink-600 md:text-4xl">
            {work.score}%
          </div>

          <div className="mt-1 text-[10px] text-zinc-500 md:text-sm">
            今買う価値
          </div>
        </div>

      </div>

    </div>

  </div>

  {/* 情報カード */}
  <div className="col-span-2 min-h-[210px] rounded-3xl border bg-white p-4 md:p-6 lg:col-span-1 lg:h-[210px]">

    <div className="grid grid-cols-2 gap-y-5">

      <div>
        <div className="text-xs text-zinc-400">
          発売日
        </div>

        <div className="font-bold">
          {work.release_date}
        </div>
      </div>

      <div>
        <div className="text-xs text-zinc-400">
          ランキング
        </div>

        <div className="font-bold">
          {hasValidRanking ? `${work.ranking}位` : "---"}
        </div>
      </div>

      <div>
        <div className="text-xs text-zinc-400">
          レビュー
        </div>

        <div className="font-bold">
          ⭐ {work.review_average}
        </div>
      </div>

      <div>
        <div className="text-xs text-zinc-400">
          件数
        </div>

        <div className="font-bold">
          {work.review_count}件
        </div>
      </div>

      <div>
        <div className="text-xs text-zinc-400">
          価格
        </div>

        <div className="font-black text-pink-600">
          ¥{(work.sale_price || work.price).toLocaleString()}
        </div>
      </div>

      <div>
        <div className="text-xs text-zinc-400">
          メーカー
        </div>

        <div className="font-bold">
          {work.maker}
        </div>
      </div>

    </div>

  </div>

</div>
      </div>
{viewerOpen &&
 selected !== "movie" && (
  <ImageViewer
    images={sampleImages}
    current={selected}
    onClose={() =>
      setViewerOpen(false)
    }
    onPrev={() =>
      setSelected(
        selected === 0
          ? sampleImages.length - 1
          : selected - 1
      )
    }
    onNext={() =>
      setSelected(
        (selected + 1) %
          sampleImages.length
      )
    }
  />
)}
    </div>
  );
}
