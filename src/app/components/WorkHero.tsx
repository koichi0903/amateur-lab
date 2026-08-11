"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Work } from "@/types/work";
import ImageViewer from "./ImageViewer";

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

const [selected, setSelected] = useState<
  "movie" | number
>("movie");

const [viewerOpen, setViewerOpen] =
  useState(false);

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

  <button
    className="mt-4 flex h-11 w-full items-center justify-center rounded-full border bg-white text-sm font-semibold shadow-sm transition hover:bg-pink-50"
  >
    ♡ お気に入り
  </button>

</div>

      {/* 右カラム */}
      <div className="min-w-0">

        <h1 className="break-words text-2xl font-black leading-tight tracking-tight text-zinc-900 sm:text-3xl lg:text-[38px] lg:leading-[1.15]">
          {work.title}
        </h1>

        <div className="mt-4 flex flex-wrap gap-2">

 {work.actress && (
  <span className="rounded-full bg-pink-100 px-4 py-1.5 text-sm font-semibold text-pink-700">
    👩 {work.actress}
  </span>
)}

{work.maker && (
  <span className="rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-700">
    🏢 {work.maker}
  </span>
)}

{work.series && (
  <span className="rounded-full bg-yellow-100 px-4 py-1.5 text-sm font-semibold text-yellow-700">
    📚 {work.series}
  </span>
)}

{work.genre && (
  <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">
    🏷 {work.genre}
  </span>
)}

</div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
  {/* 発掘スコア */}
  <div className="flex h-[210px] flex-col justify-center rounded-3xl border bg-white p-6 text-center">

    <div className="text-sm text-zinc-500">
      発掘スコア
    </div>

    <div className="mt-3 text-6xl font-black text-pink-600">
      {work.score}
    </div>

    <div className="mt-2 text-sm text-zinc-400">
      /100
    </div>

    <div className="mt-4 text-yellow-500 text-xl">
      ★★★★★
    </div>

  </div>

  {/* 総合おすすめ */}
  <div className="flex h-[210px] flex-col justify-center rounded-3xl border bg-white p-6 text-center">

    <div className="text-sm text-zinc-500">
      総合おすすめ度
    </div>

    <div className="mt-5 flex justify-center">

      <div className="flex h-32 w-32 items-center justify-center rounded-full border-[10px] border-pink-500">

        <div>
          <div className="text-4xl font-black text-pink-600">
            {work.score}%
          </div>

          <div className="text-sm text-zinc-500">
            今買う価値
          </div>
        </div>

      </div>

    </div>

  </div>

  {/* 情報カード */}
  <div className="h-[210px] rounded-3xl border bg-white p-6">

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
          {work.ranking}位
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
