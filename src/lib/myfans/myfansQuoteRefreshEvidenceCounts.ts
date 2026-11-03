export type MyfansQuoteRefreshEvidenceItem = {
  collection_evidence?: unknown;
};

type MyfansQuoteRefreshStatusCounts = {
  navigationAttempted: number;
  threadsObserved: number;
  fullyObserved: number;
  authorReplies: number;
  threadLinks: number;
};

type MyfansQuoteRefreshProfileCounts = {
  scanOk: number;
  articles: number;
  ownPosts: number;
  mediaPosts: number;
};

type MyfansQuoteRefreshEvidenceCounts = {
  status: MyfansQuoteRefreshStatusCounts;
  profile: MyfansQuoteRefreshProfileCounts;
};

function recordValue(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function numericCount(value: unknown) {
  return Number(value ?? 0);
}

function addStatusEvidence(counts: MyfansQuoteRefreshStatusCounts, status: Record<string, unknown>) {
  counts.navigationAttempted += numericCount(status.navigationAttempted);
  counts.threadsObserved += numericCount(status.threadsObserved);
  counts.fullyObserved += numericCount(status.fullyObserved);
  counts.authorReplies += numericCount(status.authorReplies);
  counts.threadLinks += numericCount(status.threadLinks);
}

function addProfileEvidence(counts: MyfansQuoteRefreshProfileCounts, profile: Record<string, unknown>) {
  const ownPosts = numericCount(profile.ownPosts);
  counts.scanOk += ownPosts > 0 ? 1 : 0;
  counts.articles += numericCount(profile.articles);
  counts.ownPosts += ownPosts;
  counts.mediaPosts += numericCount(profile.mediaPosts);
}

export function summarizeMyfansQuoteRefreshEvidence(items: MyfansQuoteRefreshEvidenceItem[]) {
  const counts: MyfansQuoteRefreshEvidenceCounts = {
    status: { navigationAttempted: 0, threadsObserved: 0, fullyObserved: 0, authorReplies: 0, threadLinks: 0 },
    profile: { scanOk: 0, articles: 0, ownPosts: 0, mediaPosts: 0 },
  };

  for (const item of items) {
    const evidence = recordValue(item.collection_evidence);
    addStatusEvidence(counts.status, recordValue(evidence.statusCounts));
    addProfileEvidence(counts.profile, recordValue(evidence.profileCounts));
  }

  return counts;
}
