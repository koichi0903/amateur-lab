"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import ImageViewer from "./ImageViewer";

type Props = {
  images: {
    image_url: string;
    sort_order: number;
  }[];
};

export default function SampleImageCarousel({
  images,
}: Props) {
const [current, setCurrent] = useState<number | null>(null);

const scrollRef =
  useRef<HTMLDivElement>(null);

  if (images.length === 0) return null;

  return (
    <section className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">

      <h2 className="mb-5 text-2xl font-black">
        📷 サンプル画像
      </h2>

      <div className="relative">

  <button
    onClick={() =>
      scrollRef.current?.scrollBy({
        left: -500,
        behavior: "smooth",
      })
    }
    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-white"
  >
    ◀
  </button>

  <div
    ref={scrollRef}
    className="
      flex
      gap-3
      overflow-x-auto
      scroll-smooth
      whitespace-nowrap
      px-12
      [&::-webkit-scrollbar]:hidden
      [-ms-overflow-style:none]
      [scrollbar-width:none]
    "
  >
    {images.map((image, index) => (
      <Image
        key={image.sort_order}
        src={image.image_url}
        alt=""
        width={160}
        height={90}
        onClick={() => setCurrent(index)}
        className="
          h-28
          w-auto
          cursor-pointer
          rounded-xl
          border
          object-cover
          transition
          hover:scale-105
          shrink-0
        "
      />
    ))}
  </div>

  <button
    onClick={() =>
      scrollRef.current?.scrollBy({
        left: 500,
        behavior: "smooth",
      })
    }
    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-white"
  >
    ▶
  </button>

</div>
  <button
  onClick={() =>
    scrollRef.current?.scrollBy({
      left: 500,
      behavior: "smooth",
    })
  }
  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-white"
>
  ▶
</button>

  {current !== null && (
  <ImageViewer
    images={images}
    current={current}
    onClose={() => setCurrent(null)}
    onPrev={() =>
      setCurrent(
        (current - 1 + images.length) %
          images.length
      )
    }
    onNext={() =>
      setCurrent(
        (current + 1) %
          images.length
      )
    }
  />
)}

    </section>
  );
}
