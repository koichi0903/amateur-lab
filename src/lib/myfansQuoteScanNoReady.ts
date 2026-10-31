import { cleanText } from "./myfansCompanionInput";

type CollectionStatus = { status?: unknown };

export type NoReadyQuoteCandidateOutcome =
  | { kind: "no-body" }
  | {
      kind: "thread-status";
      statuses: CollectionStatus[];
      incomplete: boolean;
      reason: unknown;
      error?: string;
    };

export function resolveNoReadyQuoteCandidateOutcome(input: {
  hasCollectorCandidate: boolean;
  statuses: CollectionStatus[] | undefined;
  incompleteStatuses: ReadonlySet<string>;
}): NoReadyQuoteCandidateOutcome {
  const { hasCollectorCandidate, statuses, incompleteStatuses } = input;
  if (!hasCollectorCandidate || !Array.isArray(statuses)) return { kind: "no-body" };

  const incompleteStatus = statuses.find((item) => incompleteStatuses.has(cleanText(item.status)));
  const incomplete = Boolean(incompleteStatus);
  const reason = incompleteStatus?.status || "THREAD_INCOMPLETE_WITHOUT_LINK";
  const error = incomplete ? `${reason}: status threadを十分に観測できませんでした。` : undefined;

  return { kind: "thread-status", statuses, incomplete, reason, error };
}
