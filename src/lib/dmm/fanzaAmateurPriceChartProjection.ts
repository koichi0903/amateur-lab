import { priceNumber, type FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";

export type FanzaAmateurPriceChartPoint = {
  price: number;
  changedAt: string;
  priceKind: "regular" | "sale" | null;
  isCurrent?: boolean;
};

export type FanzaAmateurSummaryPriceRow = { content_id: string; observed_at: string; price: unknown };

export function indexFanzaAmateurPriceHistory(rows: FanzaAmateurSummaryPriceRow[]) {
  const historyByContentId = new Map<string, FanzaAmateurPriceChartPoint[]>();
  for (const row of rows) {
    const price = priceNumber(row.price);
    if (price == null) continue;
    const history = historyByContentId.get(row.content_id) ?? [];
    history.push({ price, changedAt: row.observed_at, priceKind: null });
    historyByContentId.set(row.content_id, history);
  }
  return historyByContentId;
}

export function projectFanzaAmateurPriceChart<TItem extends Pick<FanzaAmateurCatalogItem, "content_id" | "currentPrice">>(
  item: TItem,
  historyByContentId: Map<string, FanzaAmateurPriceChartPoint[]>,
  windowStartAt: string,
  windowEndAt: string,
  rank?: number,
) {
  const history = [...(historyByContentId.get(item.content_id) ?? [])]
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const priceHistory = item.currentPrice == null ? history : [
    ...history,
    { price: item.currentPrice, changedAt: windowEndAt, priceKind: null, isCurrent: true },
  ];
  return {
    item,
    rank,
    priceHistory,
    priceWindowStartAt: windowStartAt,
    priceWindowEndAt: windowEndAt,
    lowestObservedPrice: priceHistory.length ? Math.min(...priceHistory.map((point) => point.price)) : null,
  };
}
