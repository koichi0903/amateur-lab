import { getPeriodRankingProducts } from "./getPeriodRankingProducts";

const WEEKLY_RANKING_URL =
  "https://video.dmm.co.jp/av/ranking/?term=weekly";

const WEEKLY_ITEMS_PER_PAGE = 100;
const WEEKLY_MAX_PAGES = 1;

export async function getWeeklyRanking() {
  return getPeriodRankingProducts(
  WEEKLY_RANKING_URL,
  WEEKLY_ITEMS_PER_PAGE,
  WEEKLY_MAX_PAGES
);
}