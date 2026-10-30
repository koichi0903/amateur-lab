import { getBijyoRecentReleasedWorks } from "@/lib/bijyoReservedAutoPost";
import { getBijyoHistoryPage, getBijyoReservedQueueWorks } from "@/lib/bijyoReadPages";
import { BijyoHistory } from "./BijyoHistory";
import { ReservedBijyoWorks } from "./ReservedBijyoWorks";
import { UpcomingBijyoReleases } from "./UpcomingBijyoReleases";

export async function BijyoUpcomingSection() {
  const result = await getBijyoRecentReleasedWorks();
  return <><UpcomingBijyoReleases works={result.recentReleased} />{result.error && <p role="alert" className="mt-3 rounded border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">発売予定を取得できませんでした: {result.error}</p>}</>;
}

export async function BijyoReservedSection() {
  const result = await getBijyoReservedQueueWorks();
  return <><ReservedBijyoWorks initialWorks={result.works} initialHasMore={result.hasMore} />{result.error && <p role="alert" className="mt-3 rounded border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">予約作品を取得できませんでした: {result.error}</p>}</>;
}

export async function BijyoHistorySection() {
  const result = await getBijyoHistoryPage();
  return <section id="history" className="mt-8 scroll-mt-20 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">投稿済み履歴</h2>{result.error ? <p role="alert" className="mt-3 rounded border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">履歴を取得できませんでした: {result.error}</p> : <BijyoHistory initialJobs={result.jobs} initialHasMore={result.hasMore} />}</section>;
}
