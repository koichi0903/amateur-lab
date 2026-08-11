import { getPeriodRankingProducts } from "./getPeriodRankingProducts";

const DAILY_RANKING_URL =
  "https://video.dmm.co.jp/av/ranking/?term=daily";

const DAILY_ITEMS_PER_PAGE = 20;
const DAILY_MAX_PAGES = 1;

export async function getDailyRanking() {
  return getPeriodRankingProducts(
  DAILY_RANKING_URL,
  DAILY_ITEMS_PER_PAGE,
  DAILY_MAX_PAGES
);
}