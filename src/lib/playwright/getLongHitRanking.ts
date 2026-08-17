import { getLongHitProducts } from "./getLongHitProducts";

const LONG_HIT_RANKING_URL =
  "https://video.dmm.co.jp/av/list/?sort=saleranking_asc";

const LONG_HIT_ITEMS_PER_PAGE = 120;
const LONG_HIT_MAX_PAGES = 9;
const LONG_HIT_TARGET_COUNT = 1000;

export async function getLongHitRanking() {
  return getLongHitProducts(
    LONG_HIT_RANKING_URL,
    LONG_HIT_ITEMS_PER_PAGE,
    LONG_HIT_MAX_PAGES,
    LONG_HIT_TARGET_COUNT,
  );
}
