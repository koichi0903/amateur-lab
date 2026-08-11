export interface Work {
  id: number;
  product_id: string;

  title: string;

  actress: string | null;
  genre: string | null;
  maker: string | null;
  series: string | null;

  score: number;

  actress_score: number;
  genre_score: number;
  maker_score: number;
  series_score: number;

  actress_point: number;
genre_point: number;
maker_point: number;
series_point: number;

  review_score: number;
  review_count_score: number;
  discount_score: number;
  ranking_score: number;

  new_release_score: number;
long_hit_point: number;

  ranking: number;

  price: number;
  sale_price: number;
  list_price: number | null;
  discount_rate: number;

  review_count: number;
  review_average: number;

  release_date: string | null;

  image_url: string | null;

  affiliate_url: string | null;

  url: string | null;

  memo: string | null;
  stage: string;
is_on_sale: boolean;
playwright_status: string;
label: string | null;
sale_end_at: string | null;
product_release_date: string | null;
duration: number | null;

is_bottom_price: boolean;
lowest_price: number | null;

previous_realtime_rank: number | null;
realtime_rank: number | null;
}