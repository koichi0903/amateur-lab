type QuoteRefreshJobProgress = {
  accounts_processed?: number | null;
  profile_scan_ok?: number | null;
  complete_threads_found?: number | null;
  candidates_saved?: number | null;
  no_match?: number | null;
  retryable_errors?: number | null;
  excluded_no_posts?: number | null;
  excluded_private?: number | null;
} | null;

type QuoteRefreshProgressEvidenceCounts = {
  status: { navigationAttempted: number; threadsObserved: number };
  profile: { scanOk: number; articles: number; ownPosts: number; mediaPosts: number };
};

export function buildMyfansQuoteRefreshProgressSummary(
  job: QuoteRefreshJobProgress,
  summary: Record<string, unknown>,
  evidenceCounts: QuoteRefreshProgressEvidenceCounts,
) {
  return {
    ...summary,
    accounts_processed: job?.accounts_processed ?? 0,
    profile_scan_ok: evidenceCounts.profile.scanOk,
    status_navigation_attempted: evidenceCounts.status.navigationAttempted,
    status_threads_observed: evidenceCounts.status.threadsObserved,
    complete_threads_found: job?.complete_threads_found ?? 0,
    candidates_saved: job?.candidates_saved ?? 0,
    no_match: job?.no_match ?? 0,
    retryable: job?.retryable_errors ?? 0,
    excluded: (job?.excluded_no_posts ?? 0) + (job?.excluded_private ?? 0),
    profile_counts: evidenceCounts.profile,
    status_counts: evidenceCounts.status,
  };
}
