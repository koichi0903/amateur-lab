type StoredInsight = {
  type: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type InsightWork = {
  price: number;
  list_price: number | null;
  sale_price: number | null;
  lowest_price: number | null;
  is_on_sale: boolean;
};

const tokyoDate = (value: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);

const isToday = (insight: StoredInsight, now: Date) => {
  const timestamp = insight.updated_at ?? insight.created_at;
  if (!timestamp) return false;

  const date = new Date(timestamp);
  return !Number.isNaN(date.getTime()) && tokyoDate(date) === tokyoDate(now);
};

export function isInsightVisible(
  insight: StoredInsight,
  work: InsightWork,
  now = new Date()
) {
  const currentPrice = work.sale_price ?? work.price;

  if (insight.type === "PRICE_DROP") {
    const listPrice = work.list_price ?? work.price;
    return (
      work.is_on_sale &&
      work.sale_price != null &&
      work.sale_price < listPrice
    );
  }

  if (insight.type === "LOWEST_PRICE") {
    const isCurrentLowest =
      work.lowest_price != null && currentPrice === work.lowest_price;

    if (!isCurrentLowest) return false;

    return insight.title.includes("更新") ? isToday(insight, now) : true;
  }

  return isToday(insight, now);
}
