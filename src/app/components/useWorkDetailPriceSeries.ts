import { useState } from "react";
import type { PriceHistoryItem } from "@/types/price";
import {
  createChartData,
  getDefaultPriceSeriesKey,
  getPriceSeries,
  getPriceSeriesSummary,
  priceSeriesKey,
} from "@/lib/createChartData";

type DefaultPriceSeries = { displayName: string; period: string | null } | null | undefined;

function getInitialSeriesKey(
  history: PriceHistoryItem[],
  displayPrice: number | null,
  defaultPriceSeries: DefaultPriceSeries,
) {
  const series = getPriceSeries(history);
  const representativeSeries = displayPrice != null && displayPrice > 0
    ? series.find((candidate) => {
        const points = createChartData(history, candidate.displayName, candidate.period);
        return points[points.length - 1]?.price === displayPrice;
      })
    : null;
  const seoPilotSeries = defaultPriceSeries
    ? series.find(
        (candidate) =>
          candidate.displayName === defaultPriceSeries.displayName &&
          candidate.period === defaultPriceSeries.period,
      )
    : null;
  const preferredSeries = representativeSeries ?? seoPilotSeries;
  return preferredSeries ? priceSeriesKey(preferredSeries) : getDefaultPriceSeriesKey(history);
}

export function useWorkDetailPriceSeries(
  history: PriceHistoryItem[],
  displayPrice: number | null,
  defaultPriceSeries: DefaultPriceSeries,
) {
  const [selectedSeriesKey, setSelectedSeriesKey] = useState(() =>
    getInitialSeriesKey(history, displayPrice, defaultPriceSeries),
  );
  const availableSeries = getPriceSeries(history);
  const activeSeriesKey = availableSeries.some(
    (series) => priceSeriesKey(series) === selectedSeriesKey,
  )
    ? selectedSeriesKey
    : getDefaultPriceSeriesKey(history);
  const summary = getPriceSeriesSummary(history, activeSeriesKey);

  return { activeSeriesKey, setSelectedSeriesKey, summary };
}
