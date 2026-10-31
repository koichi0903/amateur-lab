import { splitEntityNames } from "@/lib/entityNames";

export type SeriesAlertWork = {
  id: number;
  product_id: string;
  title: string;
  actress: string | null;
  maker: string | null;
  series: string | null;
};

export type SeriesAlertRule = {
  endpoint: string;
  alert_type: "actress" | "maker";
  series_name: string;
};

export function getSeriesAlertEntityNames(works: SeriesAlertWork[]) {
  return [...new Set(works.flatMap((work) => [
    ...splitEntityNames(work.actress),
    ...splitEntityNames(work.maker),
  ]))];
}

export function matchesSeriesAlertWork(alert: SeriesAlertRule, work: SeriesAlertWork) {
  const names = alert.alert_type === "actress"
    ? splitEntityNames(work.actress)
    : splitEntityNames(work.maker);
  return names.includes(alert.series_name);
}

export function seriesAlertDeliveryKey(
  endpoint: string,
  alertType: SeriesAlertRule["alert_type"],
  seriesName: string,
  workId: number,
) {
  return `${endpoint}\u0000${alertType}\u0000${seriesName}\u0000${workId}`;
}
