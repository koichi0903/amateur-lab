export type PriceHistoryItem = {
  id: number;
  changed_at: string;
  display_name: string;
  type: string;
  period?: string | null;
  price_kind?: "regular" | "sale" | null;
  normal_price: number | null;
  sale_price: number | null;
};
