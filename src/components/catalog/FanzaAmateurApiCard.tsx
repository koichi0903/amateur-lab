"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";
import AmateurFavoriteButton from "@/components/favorites/AmateurFavoriteButton";
import { trackFanzaAmateurAffiliateClick } from "@/lib/trackFanzaAmateurAffiliateClick";

function priceLabel(value: number | null) {
  return value == null ? "価格未取得" : `¥${value.toLocaleString("ja-JP")}`;
}

export default function FanzaAmateurApiCard({ item }: { item: FanzaAmateurCatalogItem }) {
  const genres = item.iteminfo?.genre?.map((genre) => genre.name).filter(Boolean).slice(0, 3) ?? [];
  const performers = item.confirmedPerformers ?? [];
  const releaseDate = item.date?.slice(0, 10) ?? "";
  const [showSample, setShowSample] = useState(false);
  const samplePlayerUrl = item.sampleMovieURL?.size_476_306;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-square bg-slate-100">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 240px" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-slate-400">画像を取得できません</div>
        )}
        <AmateurFavoriteButton contentId={item.content_id} iconOnly className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-xl leading-none text-pink-600 shadow-sm transition hover:bg-white" />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-slate-900">{item.title}</h2>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.iteminfo?.maker?.map((maker) => maker.name).filter(Boolean).join(" / ") || "メーカー情報なし"}</p>
        {performers.length > 0 && <div className="mt-2 flex min-w-0 flex-wrap gap-1 text-[11px] font-black text-pink-700">{performers.map((performer) => <Link key={performer} href={`/amateur/actress/${encodeURIComponent(performer)}`} aria-label={`${performer}の素人出演作品一覧`} className="max-w-full truncate hover:underline">{performer}</Link>)}</div>}
        {genres.length > 0 && <p className="mt-2 line-clamp-1 text-[11px] font-bold text-slate-500">{genres.join("・")}</p>}
        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2">
            <strong className="text-lg font-black text-pink-600">{priceLabel(item.currentPrice)}</strong>
            <span className="text-right text-[10px] font-bold text-slate-500">{releaseDate ? `発売 ${releaseDate}` : "発売日未取得"}</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">★ {item.reviewAverage?.toFixed(1) ?? "-"}（{item.review?.count ?? 0}件）</p>
          <Link
            href={`/amateur/${encodeURIComponent(item.content_id)}`}
            className="mt-3 flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-800 hover:border-pink-500 hover:text-pink-700"
          >
            価格履歴・作品情報を見る
          </Link>
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
            onClick={() => trackFanzaAmateurAffiliateClick({ contentId: item.content_id, sourcePage: "amateur", placement: "listing-card" })}
          >
            FANZA公式で作品を見る
          </a>
        </div>
      </div>
    </article>
  );
}

