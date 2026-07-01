export interface DmmItem {
  content_id: string;
  title: string;
  date: string;

  imageURL?: {
  large?: string;
  small?: string;
  list?: string;
};
  affiliateURL?: string;
  URL?: string;

  prices: {
    price: string;
    list_price: string;
  };

  review?: {
    average: string;
    count: number;
  };

  iteminfo?: {
    actress?: { name: string }[];
    genre?: { name: string }[];
    maker?: { name: string }[];
    series?: { name: string }[];
  };

  rank?: number;
}