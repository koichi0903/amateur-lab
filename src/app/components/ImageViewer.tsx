"use client";

import Image from "next/image";
import { useEffect } from "react";

type Props = {
  images: {
    image_url: string;
    sort_order: number;
  }[];
  current: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function ImageViewer({
  images,
  current,
  onClose,
  onPrev,
  onNext,
}: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }

    window.addEventListener("keydown", handleKey);

    return () =>
      window.removeEventListener(
        "keydown",
        handleKey
      );
  }, [onClose, onPrev, onNext]);

  return (
    <>
      {/* =========================
          PC版
      ========================== */}
      <div
        className="fixed inset-0 z-50 hidden items-center justify-center bg-black/90 md:flex"
        onClick={onClose}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-6 top-6 text-4xl font-bold text-white"
        >
          ×
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-6 text-5xl text-white"
        >
          ‹
        </button>

        <div
          className="relative"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={images[current].image_url}
            alt=""
            width={1200}
            height={800}
            className="max-h-[90vh] w-auto rounded-xl object-contain"
          />

          <div className="mt-4 text-center text-white">
            {current + 1} / {images.length}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-6 text-5xl text-white"
        >
          ›
        </button>
      </div>

      {/* =========================
          スマホ版（FANZA風）
      ========================== */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black md:hidden">
        <button
          onClick={onClose}
          className="sticky top-4 ml-auto mr-4 block rounded-full bg-black/70 px-4 py-2 text-3xl text-white"
        >
          ×
        </button>

        <div className="space-y-5 p-4 pb-10">
          {images.map((image, index) => (
            <div key={image.sort_order}>
              <div className="mb-2 text-center text-sm text-white">
                {index + 1} / {images.length}
              </div>

              <Image
                src={image.image_url}
                alt=""
                width={900}
                height={1300}
                className="w-full rounded-xl"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}