"use client";

import { useState } from "react";
import PriceChart from "./PriceChart";
import type { PriceHistoryItem } from "@/types/price";
import {
  createChartData,
  formatDisplayName,
  getDefaultPriceSeriesKey,
  getPriceSeries,
  priceSeriesKey,
} from "@/lib/createChartData";

type Props = {
  history: PriceHistoryItem[];
  selectedSeriesKey?: string;
  onSelectedSeriesChange?: (key: string) => void;
};

export default function PriceChartTabs({
  history,
  selectedSeriesKey,
  onSelectedSeriesChange,
}: Props) {
  const priceTypes = getPriceSeries(history);
  const [internalSelectedType, setInternalSelectedType] = useState(() =>
    getDefaultPriceSeriesKey(history),
  );
  const selectedType = selectedSeriesKey ?? internalSelectedType;

  const activeSeries = priceTypes.find((series) => priceSeriesKey(series) === selectedType);
  const chartData = activeSeries
    ? createChartData(history, activeSeries.displayName, activeSeries.period)
    : [];

  const selectSeries = (key: string) => {
    if (selectedSeriesKey === undefined) setInternalSelectedType(key);
    onSelectedSeriesChange?.(key);
  };

  return (
    <>
      <div className="mb-3 border-t pt-4">
        <h3 className="mb-3 text-lg font-bold">価格推移</h3>
        <div className="flex flex-wrap gap-2">
          {priceTypes.map((type) => {
            const key = priceSeriesKey(type);
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectSeries(key)}
                aria-pressed={selectedType === key}
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
