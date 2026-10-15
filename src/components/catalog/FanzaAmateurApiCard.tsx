"use client";

import { useState } from "react";
import Image from "next/image";
import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";

function priceLabel(value: number | null) {
  return value == null ? "価格未取得" : `¥${value.toLocaleString("ja-JP")}`;
}

export default function FanzaAmateurApiCard({ item }: { item: FanzaAmateurCatalogItem }) {
  const genres = item.iteminfo?.genre?.map((genre) => genre.name).filter(Boolean).slice(0, 3) ?? [];
  const releaseDate = item.date?.slice(0, 10) ?? "";
  const [showSample, setShowSample] = useState(false);
  const samplePlayerUrl = item.sampleMovieURL?.size_476_306;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-100">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 240px" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-slate-400">画像を取得できません</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-slate-900">{item.title}</h2>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.iteminfo?.maker?.map((maker) => maker.name).filter(Boolean).join(" / ") || "メーカー情報なし"}</p>
        {genres.length > 0 && <p className="mt-2 line-clamp-1 text-[11px] font-bold text-slate-500">{genres.join("・")}</p>}
        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2">
            <strong className="text-lg font-black text-pink-600">{priceLabel(item.currentPrice)}</strong>
            <span className="text-right text-[10px] font-bold text-slate-500">{releaseDate ? `発売 ${releaseDate}` : "発売日未取得"}</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">★ {item.reviewAverage?.toFixed(1) ?? "-"}（{item.review?.count ?? 0}件）</p>
          {samplePlayerUrl && (
            <button
              type="button"
              aria-expanded={showSample}
              onClick={() => setShowSample((visible) => !visible)}
              className="mt-3 flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-800 hover:border-pink-500 hover:text-pink-700"
            >
              {showSample ? "サンプル動画を閉じる" : "サンプル動画を見る"}
            </button>
          )}
          {showSample && samplePlayerUrl && (
            <div className="mt-2 overflow-hidden rounded-lg bg-black">
              <iframe
                src={samplePlayerUrl}
                title={`${item.title}の公式サンプル動画`}
                loading="lazy"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="aspect-[476/306] w-full border-0"
              />
            </div>
          )}
          <a
            href={item.affiliateURL}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-3 flex min-h-10 items-center justify-center rounded-lg bg-pink-600 px-3 text-xs font-black text-white hover:bg-pink-700"
            onClick={() => {
              window.gtag?.("event", "amateur_affiliate_click", {
                content_id: item.content_id,
                source_page: "amateur",
                affiliate_id: "991",
              });
            }}
          >
            FANZA公式で作品を見る
          </a>
        </div>
      </div>
    </article>
  );
}
