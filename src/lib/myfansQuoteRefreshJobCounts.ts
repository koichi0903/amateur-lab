export type MyfansQuoteRefreshJobCountItem = {
  status: string;
  collected_count?: number | string | null;
  collection_state?: string | null;
};

export function summarizeMyfansQuoteRefreshJobItems(items: MyfansQuoteRefreshJobCountItem[]) {
  const counts = {
    processed: 0,
    success: 0,
    failed: 0,
    completeThreadsFound: 0,
    noMatch: 0,
    excludedNoPosts: 0,
    excludedPrivate: 0,
    retryableErrors: 0,
    candidatesSaved: 0,
    runningItems: false,
    pendingItems: false,
  };

  for (const item of items) {
    const collectedCount = Number(item.collected_count ?? 0);
    if (["success", "failed", "skipped"].includes(item.status)) counts.processed += 1;
    if (item.status === "success") counts.success += 1;
    if (item.status === "failed") counts.failed += 1;
    if (collectedCount > 0) counts.completeThreadsFound += 1;
    if (item.collection_state === "NO_MATCH_THIS_RUN") counts.noMatch += 1;
    if (item.collection_state === "NO_POSTS") counts.excludedNoPosts += 1;
    if (item.collection_state === "PRIVATE") counts.excludedPrivate += 1;
    if (["TEMP_ERROR", "THREAD_INCOMPLETE"].includes(item.collection_state ?? "")) counts.retryableErrors += 1;
    counts.candidatesSaved += collectedCount;
    if (item.status === "running") counts.runningItems = true;
    if (item.status === "pending") counts.pendingItems = true;
  }

  return counts;
}
