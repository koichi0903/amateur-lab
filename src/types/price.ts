export type PriceHistoryItem = {
  id: number;
  changed_at: string;
  display_name: string;
  type: string;
  normal_price: number | null;
  sale_price: number | null;
};