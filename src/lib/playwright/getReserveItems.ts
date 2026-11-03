import { getProductIds } from "./getProductIds";

const RESERVE_URL =
  "https://video.dmm.co.jp/av/list/?release=reservation&sort=date";

export async function getReserveItems() {
  return getProductIds(RESERVE_URL, undefined, {
    // The reservation listing is occasionally slow to hydrate its cards.
    // Retry with a fresh page so a timed-out navigation does not leave the
    // next attempt waiting on the same stale page state.
    pageRetry: {
      attempts: 3,
      timeoutMs: 45_000,
      backoffMs: [2_000, 6_000],
    },
  });
}
