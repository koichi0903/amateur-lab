import { getProductIds } from "./getProductIds";

const NEW_URL =
  "https://video.dmm.co.jp/av/list/?release=latest&sort=date";

export async function getNewItems() {
  return getProductIds(NEW_URL);
}