import { getProductIds } from "./getProductIds";

const RESERVE_URL =
  "https://video.dmm.co.jp/av/list/?release=reservation&sort=date";

export async function getReserveItems() {
  return getProductIds(RESERVE_URL);
}