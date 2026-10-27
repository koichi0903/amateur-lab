"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PriceChart from "@/app/components/PriceChart";
import FanzaAmateurAffiliateLink from "@/components/catalog/FanzaAmateurAffiliateLink";
import AmateurFavoriteButton from "@/components/favorites/AmateurFavoriteButton";
import FanzaAmateurPriceAlertButton from "@/components/catalog/FanzaAmateurPriceAlertButton";
import type { FanzaAmateurCatalogItem, FanzaAmateurPriceHistoryEntry } from "@/lib/dmm/fanzaAmateurCatalog";

const priceTypeOrder = ["stream", "download", "hd", "iosdl", "androiddl"];

function formatPriceType(type: string) {
  const labels: Record<string, string> = {
    stream: "ストリーミング",
    download: "ダウンロード",
    hd: "HD",
    iosdl: "iOS",
    androiddl: "Android",
  };
  return labels[type] ?? type;
}
type Props = {
  item: FanzaAmateurCatalogItem;
  fetchedAt: string;
  volume: string | null;
  officialSampleEmbedUrl: string | null;
  sampleMovieMp4Url: string | null;
  sampleImages: string[];
  priceHistory: FanzaAmateurPriceHistoryEntry[];
};

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
function parsePrice(value: string | null | undefined) {
  const digits = value?.match(/[0-9]+/)?.[0];
  return digits ? Number(digits) : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "未取得";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function FanzaAmateurDetailHero({ item, fetchedAt, volume, officialSampleEmbedUrl, sampleMovieMp4Url, sampleImages, priceHistory }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const coverUrl = item.imageURL?.large || item.imageURL?.small || item.imageURL?.list || item.imageUrl;
  const playableMovieUrl = isOfficialMp4(sampleMovieMp4Url) ? sampleMovieMp4Url : null;
  const [preferNativeSamplePlayer, setPreferNativeSamplePlayer] = useState(false);
  useEffect(() => {
    const updatePreference = () => setPreferNativeSamplePlayer(window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 767px)").matches || navigator.maxTouchPoints > 0);
    updatePreference();
    window.addEventListener("resize", updatePreference);
    return () => window.removeEventListener("resize", updatePreference);
  }, []);
  const officialPlayerRef = useRef<HTMLDivElement>(null);
  const [officialPlayerSize, setOfficialPlayerSize] = useState({ width: 260, height: 167 });
  const compactOfficialSampleEmbedUrl = officialSampleEmbedUrl
    ?.replace(/width=\d+/, `width=${officialPlayerSize.width}`)
    .replace(/height=\d+/, `height=${officialPlayerSize.height}`);
  useLayoutEffect(() => {
    const player = officialPlayerRef.current;
    if (!player || !officialSampleEmbedUrl) return;
    const updatePlayerSize = () => {
      const width = Math.max(260, Math.round(player.getBoundingClientRect().width));
      const height = Math.round((width * 167) / 260);
      setOfficialPlayerSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    updatePlayerSize();
    const observer = new ResizeObserver(updatePlayerSize);
    observer.observe(player);
    return () => observer.disconnect();
  }, [officialSampleEmbedUrl]);
  const priceTypes = useMemo(() => [...new Set(priceHistory.map((entry) => entry.price_type).filter((type) => type !== "summary"))].sort((a, b) => {
    const aIndex = priceTypeOrder.indexOf(a);
    const bIndex = priceTypeOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  }), [priceHistory]);
  const [selectedPriceType, setSelectedPriceType] = useState("");
  const currentPrice = item.currentPrice;
  const representativePriceType = priceTypes.find((type) => {
    const deliveryPrice = item.prices.deliveries?.delivery?.find((delivery) => delivery.type === type)?.price;
    return parsePrice(deliveryPrice) === currentPrice;
  }) ?? priceTypes[0] ?? "";
  const activePriceType = priceTypes.includes(selectedPriceType) ? selectedPriceType : representativePriceType;
  const listPrice = parsePrice(item.prices?.list_price);
  const discount = currentPrice != null && listPrice != null && listPrice > currentPrice
    ? Math.round((1 - currentPrice / listPrice) * 100)
    : 0;
  const activeHistory = priceHistory
    .filter((entry) => entry.price_type === activePriceType)
    .map((entry) => ({ entry, price: parsePrice(entry.price) }))
    .filter((entry): entry is { entry: FanzaAmateurPriceHistoryEntry; price: number } => entry.price != null)
    .sort((a, b) => a.entry.observed_at.localeCompare(b.entry.observed_at));
  const currentDeliveryPrice = item.prices.deliveries?.delivery?.find((delivery) => delivery.type === activePriceType);
  const currentChartPrice = parsePrice(currentDeliveryPrice?.price);
  const chartHistory = [...activeHistory];
  if (currentChartPrice != null && fetchedAt) {
    const latest = chartHistory.at(-1);
    if (latest?.entry.observed_at === fetchedAt) {
      chartHistory[chartHistory.length - 1] = { ...latest, price: currentChartPrice };
    } else {
      chartHistory.push({
        entry: { observed_at: fetchedAt, price_type: activePriceType, price: String(currentChartPrice), list_price: currentDeliveryPrice?.list_price ?? null },
        price: currentChartPrice,
      });
    }
  }
  const chartData = chartHistory.map(({ entry, price }) => ({
    date: new Date(entry.observed_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    price,
  }));
  const lowestPrice = activeHistory.length ? Math.min(...activeHistory.map(({ price }) => price)) : null;
  const samplePlayerAvailable = Boolean(officialSampleEmbedUrl || playableMovieUrl);
  const performers = item.confirmedPerformers ?? [];
  const makers = item.iteminfo?.maker?.map((maker) => maker.name).filter(Boolean) ?? [];
  const seriesList = item.iteminfo?.series?.map((series) => series.name).filter(Boolean) ?? [];
  const genres = item.iteminfo?.genre?.map((genre) => genre.name).filter(Boolean) ?? [];

  return (
    <section className="grid gap-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:gap-8">
      <div className="min-w-0">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-zinc-950 shadow-lg">
          {selected !== null && sampleImages[selected] ? (
            <Image src={sampleImages[selected]} alt={`${item.title}のサンプル画像 ${selected + 1}`} fill priority sizes="(max-width: 1024px) 100vw, 720px" unoptimized className="object-contain" />
          ) : preferNativeSamplePlayer && playableMovieUrl ? (
            <video key={playableMovieUrl} autoPlay muted controls playsInline preload="metadata" poster={coverUrl ?? undefined} className="h-full w-full object-contain" aria-label={`${item.title}の公式サンプル動画`}><source src={playableMovieUrl} type="video/mp4" /></video>
          ) : compactOfficialSampleEmbedUrl ? (
            <div ref={officialPlayerRef} className="relative h-full w-full overflow-hidden">
              <iframe key={compactOfficialSampleEmbedUrl} src={compactOfficialSampleEmbedUrl} title={`${item.title}の公式サンプル動画`} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
            </div>
          ) : playableMovieUrl ? (
            <video key={playableMovieUrl} autoPlay muted controls playsInline preload="metadata" poster={coverUrl ?? undefined} className="h-full w-full object-contain" aria-label={`${item.title}の公式サンプル動画`}><source src={playableMovieUrl} type="video/mp4" /></video>
          ) : coverUrl ? (
            <Image src={coverUrl} alt={item.title} fill priority sizes="(max-width: 1024px) 100vw, 720px" unoptimized className="bg-white object-contain" />
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
      </div>

      <div className="min-w-0">
        <h1 className="mt-2 text-xl font-black leading-[1.375] text-slate-950 sm:text-2xl">{item.title}</h1>
        <div className="mt-5 border-y border-slate-200 py-4">
          <div className="flex flex-wrap items-end gap-3"><strong className="text-4xl font-black leading-none text-pink-600 sm:text-5xl">{currentPrice != null ? `¥${currentPrice.toLocaleString("ja-JP")}` : "価格未取得"}</strong>{discount > 0 && listPrice != null && <><span className="text-sm text-slate-400 line-through">¥{listPrice.toLocaleString("ja-JP")}</span><span className="rounded bg-pink-100 px-2 py-1 text-xs font-black text-pink-700">{discount}%OFF</span></>}</div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500"><span>発売日：<strong className="text-slate-800">{item.date?.slice(0, 10) || "未取得"}</strong></span>{volume && <span>収録時間：<strong className="text-slate-800">{volume}</strong></span>}<span>レビュー：<strong className="text-slate-800">★ {item.reviewAverage != null ? item.reviewAverage.toFixed(1) : "—"}（{item.review?.count ?? 0}件）</strong></span></div>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {performers.map((performer) => <span key={`performer-${performer}`} className="max-w-full break-words rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700">♀ {performer}</span>)}
          {makers.map((maker) => <Link key={`maker-${maker}`} href={`/amateur/search?maker=${encodeURIComponent(maker)}`} className="max-w-full break-words rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">🏢 {maker}</Link>)}
          {genres.map((genre) => <Link key={`genre-${genre}`} href={`/amateur/search?genre=${encodeURIComponent(genre)}`} className="max-w-full break-words rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">🏷 {genre}</Link>)}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">現在価格：{currentPrice != null ? `${currentPrice.toLocaleString("ja-JP")}円` : "未取得"}<br />素人作品データ取得日：{formatDate(fetchedAt)}<br />{lowestPrice != null ? `発掘LABの記録上の最安値（${activePriceType || "価格"}）：${lowestPrice.toLocaleString("ja-JP")}円。` : "価格履歴から最安値を判定するデータはまだありません。"}<br />作品コード：{item.content_id}</p>
        <div className="mt-6 mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 border-t pt-4"><h2 className="mb-3 text-lg font-bold">価格推移</h2><div className="flex flex-wrap gap-2">{priceTypes.map((type) => <button key={type} type="button" onClick={() => setSelectedPriceType(type)} className={`rounded-full border px-3 py-1 text-sm transition ${activePriceType === type ? "bg-pink-500 text-white" : "bg-pink-50 hover:bg-pink-100"}`}>{formatPriceType(type)}</button>)}</div></div>
          {chartData.length > 0 ? <PriceChart data={chartData} /> : <p className="py-8 text-center text-sm text-slate-500">価格推移はまだありません。</p>}
          <div className="text-xs text-slate-500">履歴 {activeHistory.length}点{chartHistory.length > activeHistory.length ? "・最新取得価格を含む" : ""}</div>
        </div>
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1"><FanzaAmateurAffiliateLink href={item.affiliateURL} contentId={item.content_id} sourcePage="amateur_detail" price={currentPrice} /></div>
          <AmateurFavoriteButton contentId={item.content_id} iconOnly className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-2xl leading-none text-slate-600 transition hover:border-pink-200 hover:bg-pink-50" />
        </div>
        <FanzaAmateurPriceAlertButton contentId={item.content_id} workTitle={item.title} makers={[...new Set(item.iteminfo?.maker?.map((maker) => maker.name.trim()).filter(Boolean) ?? [])]} />
        {seriesList.length > 0 && <div className="mt-5 flex min-w-0 flex-wrap gap-2 border-t border-slate-200 pt-4">
          {seriesList.map((series) => <Link key={`series-${series}`} href={`/amateur/search?q=${encodeURIComponent(series)}`} className="max-w-full break-words rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">▣ {series}</Link>)}
        </div>}
      </div>
    </section>
  );
}

