import type { MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";

export type QuoteScanPayload = {
  type?: unknown;
  productId?: unknown;
  creatorId?: unknown;
  creatorXUrl?: unknown;
  sourceXHandle?: unknown;
  refreshJobId?: unknown;
  refreshJobItemId?: unknown;
  failureReason?: unknown;
  quoteCandidates?: MyfansQuoteScanCandidate[];
  diagnosticMode?: boolean;
  diagnosticRunId?: unknown;
  sourceStatusUrl?: unknown;
  statusCandidate?: MyfansQuoteScanCandidate & { authorHandle?: unknown };
  singleStatusRunId?: unknown;
  collectionError?: unknown;
  collectionFailure?: { stage?: unknown; errorCode?: unknown; diagnostics?: Record<string, unknown>; transitions?: Array<Record<string, unknown>> };
  collectionStatuses?: Array<{ parentStatusUrl?: unknown; status?: unknown }>;
  stateTransitions?: Array<{ stage?: unknown; at?: unknown; [key: string]: unknown }>;
  profileCounts?: Record<string, unknown>;
  profileScan?: Record<string, unknown>;
  statusCounts?: Record<string, unknown>;
  collectionSessionId?: unknown;
  runToken?: unknown;
  collectorVersion?: unknown;
};

export type QuoteScanProduct = {
  id: number;
  creator_id: number | null;
  approved_media_id: number | null;
  title: string;
  creator_x_url: string | null;
};
