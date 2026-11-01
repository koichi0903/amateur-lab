export type QuoteRefreshRunIdentity = {
  sessionId: string;
  runToken: string;
  collectorVersion: string;
};

type QuoteRefreshJobIdentity = {
  collection_session_id: string | null;
  collection_run_token: string | null;
  collector_version: string | null;
};

export function matchesQuoteRefreshJobIdentity(
  job: QuoteRefreshJobIdentity | null | undefined,
  identity: QuoteRefreshRunIdentity,
) {
  return Boolean(
    job &&
      identity.sessionId &&
      identity.runToken &&
      job.collection_session_id === identity.sessionId &&
      job.collection_run_token === identity.runToken &&
      job.collector_version === identity.collectorVersion,
  );
}
