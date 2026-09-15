import { getRankingProducts } from "./getRankingProducts";
import { RANKING_UPDATE_CONFIG } from "@/config/update";

const REALTIME_RANKING_URL =
  "https://video.dmm.co.jp/av/list/?sort=ranking";

const REALTIME_ITEMS_PER_PAGE = RANKING_UPDATE_CONFIG.fanzaItemsPerPage;
const REALTIME_TARGET_COUNT = RANKING_UPDATE_CONFIG.targetCount;
const REALTIME_MAX_PAGES = Math.ceil(
  REALTIME_TARGET_COUNT / REALTIME_ITEMS_PER_PAGE,
);

export async function getRealtimeRanking() {
  return getRankingProducts(
    REALTIME_RANKING_URL,
    REALTIME_ITEMS_PER_PAGE,
    REALTIME_MAX_PAGES,
    REALTIME_TARGET_COUNT,
  );
}
