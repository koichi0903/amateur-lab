"use client";

import PriceChart from "@/app/components/PriceChart";
import type { FanzaAmateurCatalogItem, FanzaAmateurPriceHistoryEntry } from "@/lib/dmm/fanzaAmateurCatalog";
import { formatFanzaAmateurPriceType } from "@/lib/dmm/fanzaAmateurCatalogDetailProjection";

type HistoryPoint = { entry: FanzaAmateurPriceHistoryEntry; price: number };

function formatDate(value: string | null | undefined) {
  if (!value) return "未取得";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function FanzaAmateurDetailPricing({
  item,
  volume,
  fetchedAt,
  currentPrice,
  listPrice,
  discount,
  activePriceType,
  priceTypes,
  activeHistory,
  chartHistory,
  chartData,
  lowestPrice,
  onPriceTypeSelect,
}: {
  item: FanzaAmateurCatalogItem;
  volume: string | null;
  fetchedAt: string;
  currentPrice: number | null;
  listPrice: number | null;
  discount: number;
  activePriceType: string;
  priceTypes: string[];
  activeHistory: HistoryPoint[];
  chartHistory: HistoryPoint[];
  chartData: Array<{ date: string; price: number }>;
  lowestPrice: number | null;
  onPriceTypeSelect: (type: string) => void;
}) {
  return <>
    <div className="mt-5 border-y border-slate-200 py-4">
      <div className="flex flex-wrap items-end gap-3"><strong className="text-4xl font-black leading-none text-pink-600 sm:text-5xl">{currentPrice != null ? `¥${currentPrice.toLocaleString("ja-JP")}` : "価格未取得"}</strong>{discount > 0 && listPrice != null && <><span className="text-sm text-slate-400 line-through">¥{listPrice.toLocaleString("ja-JP")}</span><span className="rounded bg-pink-100 px-2 py-1 text-xs font-black text-pink-700">{discount}%OFF</span></>}</div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500"><span>発売日：<strong className="text-slate-800">{item.date?.slice(0, 10) || "未取得"}</strong></span>{volume && <span>収録時間：<strong className="text-slate-800">{volume}</strong></span>}<span>レビュー：<strong className="text-slate-800">★ {item.reviewAverage != null ? item.reviewAverage.toFixed(1) : "—"}（{item.review?.count ?? 0}件）</strong></span></div>
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-600">現在価格：{currentPrice != null ? `${currentPrice.toLocaleString("ja-JP")}円` : "未取得"}<br />素人作品データ取得日：{formatDate(fetchedAt)}<br />{lowestPrice != null ? `発掘LABの記録上の最安値（${activePriceType || "価格"}）：${lowestPrice.toLocaleString("ja-JP")}円。` : "価格履歴から最安値を判定するデータはまだありません。"}<br />作品コード：{item.content_id}</p>
    <div className="mt-6 mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 border-t pt-4"><h2 className="mb-3 text-lg font-bold">価格推移</h2><div className="flex flex-wrap gap-2">{priceTypes.map((type) => <button key={type} type="button" onClick={() => onPriceTypeSelect(type)} className={`rounded-full border px-3 py-1 text-sm transition ${activePriceType === type ? "bg-pink-500 text-white" : "bg-pink-50 hover:bg-pink-100"}`}>{formatFanzaAmateurPriceType(type)}</button>)}</div></div>
      {chartData.length > 0 ? <PriceChart data={chartData} /> : <p className="py-8 text-center text-sm text-slate-500">価格推移はまだありません。</p>}
      <div className="text-xs text-slate-500">履歴 {activeHistory.length}点{chartHistory.length > activeHistory.length ? "・最新取得価格を含む" : ""}</div>
    </div>
  </>;
}
