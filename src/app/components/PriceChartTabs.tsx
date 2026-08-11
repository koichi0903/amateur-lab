"use client";

import { useState } from "react";

import PriceChart from "./PriceChart";
import type { PriceHistoryItem } from "@/types/price";
import {
  createChartData,
  normalizeDisplayName,
  formatDisplayName,
} from "@/lib/createChartData";

type Props = {
  history: PriceHistoryItem[];
};

export default function PriceChartTabs({
  history,
}: Props) {
  const priceTypes = Array.from(
  new Set(
    history.map((item) =>
      normalizeDisplayName(item.display_name)
    )
  )
).sort((a, b) => {
  const order = [
    "ダウンロード＋ストリーミング",
    "HQ版ダウンロード＋HQ版ストリーミング",
    "HD版ダウンロード＋HD版ストリーミング",
    "4K版ダウンロード＋4K版ストリーミング",
    "8KVR版ダウンロード＋8KVR版ストリーミング",
    "HD版ストリーミング",
    "ストリーミング",
  ];

  const ia = order.indexOf(a);
  const ib = order.indexOf(b);

  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;

  return ia - ib;
});

  const defaultType =
  history
    .filter((item) => item.sale_price)
    .sort(
      (a, b) =>
        (a.sale_price ?? a.normal_price ?? 999999) -
        (b.sale_price ?? b.normal_price ?? 999999)
    )[0];

const [selectedType, setSelectedType] =
  useState(
    normalizeDisplayName(
      defaultType?.display_name ?? priceTypes[0] ?? ""
    )
  );

  const chartData = createChartData(
    history,
    selectedType
  );

  return (
    <>
      <div className="mb-3 border-t pt-4">
        <h3 className="mb-3 text-lg font-bold">
          📈 価格推移
        </h3>

        <div className="flex flex-wrap gap-2">
          {priceTypes.map((type) => (
            <button
              key={type}
              onClick={() =>
                setSelectedType(type)
              }
              className={`rounded-full border px-3 py-1 text-sm transition ${
                selectedType === type
                  ? "bg-pink-500 text-white"
                  : "bg-pink-50 hover:bg-pink-100"
              }`}
            >
              {formatDisplayName(type)}
            </button>
          ))}
        </div>
      </div>

      <PriceChart data={chartData} />
    </>
  );
}