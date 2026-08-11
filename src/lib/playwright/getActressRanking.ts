import { getPeriodActressRanking } from "./getPeriodActressRanking";

const ACTRESS_RANKING_URL =
  "https://video.dmm.co.jp/av/ranking/?term=monthly&type=actress";

const ACTRESS_ITEMS_PER_PAGE = 100;
const ACTRESS_MAX_PAGES = 1;

export async function getActressRanking() {
  return getPeriodActressRanking(
  ACTRESS_RANKING_URL,
  ACTRESS_ITEMS_PER_PAGE,
  ACTRESS_MAX_PAGES,
  'a[href*="/av/list/?actress="]'
);
}