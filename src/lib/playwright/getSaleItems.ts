import { getProductIds } from "./getProductIds";

const SALE_URL =
  "https://video.dmm.co.jp/av/list/?campaign=all&sort=suggest";

export async function getSaleItems() {
  return getProductIds(SALE_URL);
}