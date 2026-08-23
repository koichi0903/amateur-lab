import { getRankingProducts } from "./getRankingProducts";

const REALTIME_RANKING_URL =
  "https://video.dmm.co.jp/av/list/?sort=ranking";

const REALTIME_ITEMS_PER_PAGE = 120;
const REALTIME_MAX_PAGES = 84;
const REALTIME_TARGET_COUNT = 10000;

export async function getRealtimeRanking() {
  return getRankingProducts(
    REALTIME_RANKING_URL,
    REALTIME_ITEMS_PER_PAGE,
    REALTIME_MAX_PAGES,
    REALTIME_TARGET_COUNT,
  );
}
