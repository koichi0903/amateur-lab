export type MyfansQuoteRefreshEvidenceItem = {
  collection_evidence?: unknown;
};

function recordValue(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function summarizeMyfansQuoteRefreshEvidence(items: MyfansQuoteRefreshEvidenceItem[]) {
  const counts = {
    status: { navigationAttempted: 0, threadsObserved: 0, fullyObserved: 0, authorReplies: 0, threadLinks: 0 },
    profile: { scanOk: 0, articles: 0, ownPosts: 0, mediaPosts: 0 },
  };

  for (const item of items) {
    const evidence = recordValue(item.collection_evidence);
    const status = recordValue(evidence.statusCounts);
    const profile = recordValue(evidence.profileCounts);
    counts.status.navigationAttempted += Number(status.navigationAttempted ?? 0);
    counts.status.threadsObserved += Number(status.threadsObserved ?? 0);
    counts.status.fullyObserved += Number(status.fullyObserved ?? 0);
    counts.status.authorReplies += Number(status.authorReplies ?? 0);
    counts.status.threadLinks += Number(status.threadLinks ?? 0);
    const ownPosts = Number(profile.ownPosts ?? 0);
    counts.profile.scanOk += ownPosts > 0 ? 1 : 0;
    counts.profile.articles += Number(profile.articles ?? 0);
    counts.profile.ownPosts += ownPosts;
    counts.profile.mediaPosts += Number(profile.mediaPosts ?? 0);
  }

  return counts;
}
