import { isActiveQuoteRefreshStatus } from "./myfansQuoteRefreshLifecycle";

export type QuoteRefreshNextItemJobIdentity = {
  status: string;
  collection_session_id?: string | null;
  collection_run_token?: string | null;
  collector_version?: string | null;
};

export type QuoteRefreshNextItemGate =
  | "no_job"
  | "identity_mismatch"
  | "paused"
  | "cancelled"
  | "inactive"
  | "session_mismatch"
  | null;

export function classifyQuoteRefreshNextItemGate({
  job,
  sessionId,
  runToken,
  collectorVersion,
}: {
  job: QuoteRefreshNextItemJobIdentity | null;
  sessionId: string;
  runToken: string;
  collectorVersion: string;
}): QuoteRefreshNextItemGate {
  if (!job) return "no_job";
  if (!sessionId || !runToken || job.collection_session_id !== sessionId || job.collection_run_token !== runToken || job.collector_version !== collectorVersion) return "identity_mismatch";
  if (job.status === "paused") return "paused";
  if (job.status === "cancelled") return "cancelled";
  if (!isActiveQuoteRefreshStatus(job.status)) return "inactive";
  if (sessionId && job.collection_session_id !== sessionId) return "session_mismatch";
  return null;
}
