import { getProductIds } from "./getProductIds";

const SEMI_NEW_URL =
  "https://video.dmm.co.jp/av/list/?release=recent&sort=date";

export async function getSemiNewItems() {
  return getProductIds(SEMI_NEW_URL);
}