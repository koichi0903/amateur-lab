import { getPeriodActressRanking } from "./getPeriodActressRanking";

const SERIES_RANKING_URL =
  "https://video.dmm.co.jp/av/ranking/?term=monthly&type=series";

const SERIES_ITEMS_PER_PAGE = 100;
const SERIES_MAX_PAGES = 1;

export async function getSeriesRanking() {
  return getPeriodActressRanking(
    SERIES_RANKING_URL,
    SERIES_ITEMS_PER_PAGE,
    SERIES_MAX_PAGES,
    'a[href*="/av/list/?series="]'
  );
}