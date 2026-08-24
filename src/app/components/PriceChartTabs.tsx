"use client";

import { useState } from "react";
import PriceChart from "./PriceChart";
import type { PriceHistoryItem } from "@/types/price";
import { createChartData, formatDisplayName, normalizeDisplayName } from "@/lib/createChartData";

type Props = { history: PriceHistoryItem[] };
type PriceSeries = { displayName: string; period: string | null };

const seriesKey = (series: PriceSeries) => `${series.displayName}\u0000${series.period ?? ""}`;

export default function PriceChartTabs({ history }: Props) {
  const priceTypes = Array.from(
    new Map(
      history.map((item) => {
        const series = { displayName: normalizeDisplayName(item.display_name), period: item.period ?? null };
        return [seriesKey(series), series] as const;
      }),
    ).values(),
  ).sort((a, b) => a.displayName.localeCompare(b.displayName) || (a.period ?? "").localeCompare(b.period ?? ""));

  const defaultType = [...history]
    .filter((item) => item.sale_price != null && item.sale_price > 0)
    .sort((a, b) => (a.sale_price ?? a.normal_price ?? 999999) - (b.sale_price ?? b.normal_price ?? 999999))[0];

  const [selectedType, setSelectedType] = useState(
    defaultType
      ? seriesKey({ displayName: normalizeDisplayName(defaultType.display_name), period: defaultType.period ?? null })
      : priceTypes[0]
        ? seriesKey(priceTypes[0])
        : "",
  );

  const [selectedName, selectedPeriod = ""] = selectedType.split("\u0000");
  const chartData = createChartData(history, selectedName, selectedPeriod || null);

  return (
    <>
      <div className="mb-3 border-t pt-4">
        <h3 className="mb-3 text-lg font-bold">価格推移</h3>
        <div className="flex flex-wrap gap-2">
          {priceTypes.map((type) => {
            const key = seriesKey(type);
            return (
              <button
                key={key}
                onClick={() => setSelectedType(key)}
                className={`rounded-full border px-3 py-1 text-sm transition ${selectedType === key ? "bg-pink-500 text-white" : "bg-pink-50 hover:bg-pink-100"}`}
              >
                {formatDisplayName(type.displayName)}
                {type.period && (
                  <span className="ml-1 font-bold">[{type.period}]</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <PriceChart data={chartData} />
    </>
  );
}
