export type MyfansQuoteRefreshJobCountItem = {
  status: string;
  collected_count?: number | string | null;
  collection_state?: string | null;
};

function createJobCounts() {
  return {
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
}

type JobCounts = ReturnType<typeof createJobCounts>;

function addStatusCounts(counts: JobCounts, item: MyfansQuoteRefreshJobCountItem) {
  if (["success", "failed", "skipped"].includes(item.status)) counts.processed += 1;
  if (item.status === "success") counts.success += 1;
  if (item.status === "failed") counts.failed += 1;
  if (item.status === "running") counts.runningItems = true;
  if (item.status === "pending") counts.pendingItems = true;
}

function addCollectionStateCounts(counts: JobCounts, collectionState: string | null | undefined) {
  switch (collectionState) {
    case "NO_MATCH_THIS_RUN":
      counts.noMatch += 1;
      break;
    case "NO_POSTS":
      counts.excludedNoPosts += 1;
      break;
    case "PRIVATE":
      counts.excludedPrivate += 1;
      break;
    case "TEMP_ERROR":
    case "THREAD_INCOMPLETE":
      counts.retryableErrors += 1;
      break;
  }
}

export function summarizeMyfansQuoteRefreshJobItems(items: MyfansQuoteRefreshJobCountItem[]) {
  const counts = createJobCounts();
  for (const item of items) {
    const collectedCount = Number(item.collected_count ?? 0);
    addStatusCounts(counts, item);
    if (collectedCount > 0) counts.completeThreadsFound += 1;
    addCollectionStateCounts(counts, item.collection_state);
    counts.candidatesSaved += collectedCount;
  }

  return counts;
}
