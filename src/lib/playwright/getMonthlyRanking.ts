import { getPeriodRankingProducts } from "./getPeriodRankingProducts";

const MONTHLY_RANKING_URL =
  "https://video.dmm.co.jp/av/ranking/?term=monthly";

const MONTHLY_ITEMS_PER_PAGE = 100;
const MONTHLY_MAX_PAGES = 1;

export async function getMonthlyRanking() {
  return getPeriodRankingProducts(
  MONTHLY_RANKING_URL,
  MONTHLY_ITEMS_PER_PAGE,
  MONTHLY_MAX_PAGES
);
}