export const MYFANS_COLLECTION_KEY = "myfans_quote_refresh";
// Keep each browser session small enough to avoid a burst of profile/status
// navigations. The cursor makes the next run continue with different creators.
export const MAX_MYFANS_ACCOUNTS_PER_RUN = 5;

export type CollectionAccount = {
  creatorId: number;
  rotationOrder: number;
  collectionEnabled: boolean;
};

export type CollectionCursor = {
  cursorOrder: number;
  cycleNo: number;
};

export function selectCollectionAccounts(
  accounts: readonly CollectionAccount[],
  cursor: CollectionCursor,
  requestedLimit: number,
) {
  const eligible = accounts
    .filter((account) => account.collectionEnabled)
    .sort((a, b) => a.rotationOrder - b.rotationOrder || a.creatorId - b.creatorId);
  const limit = Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, Math.max(1, Math.round(requestedLimit || MAX_MYFANS_ACCOUNTS_PER_RUN)));
  if (!eligible.length) return { selected: [], nextCursor: cursor, cycleCompleted: false, eligibleCount: 0, remainingCount: 0 };

  const afterCursor = eligible.filter((account) => account.rotationOrder > cursor.cursorOrder);
  const wrapped = afterCursor.length === 0;
  const ordered = wrapped ? eligible : afterCursor;
  const selected = ordered.slice(0, Math.min(limit, ordered.length));
  const selectedLast = selected[selected.length - 1];
  const cycleCompleted = Boolean(selectedLast && selectedLast.rotationOrder >= (eligible.at(-1)?.rotationOrder ?? 0));
  const nextCycleNo = wrapped ? cursor.cycleNo + 1 : cursor.cycleNo;
  return {
    selected,
    nextCursor: { cursorOrder: selectedLast?.rotationOrder ?? cursor.cursorOrder, cycleNo: nextCycleNo },
    cycleCompleted,
    eligibleCount: eligible.length,
    remainingCount: wrapped ? 0 : Math.max(0, eligible.length - afterCursor.length),
  };
}

export function collectionOutcomeForResult(input: { candidatesCount: number; errorCode?: string | null; threadIncomplete?: boolean }) {
  if (input.errorCode === "NO_POSTS") return "NO_POSTS" as const;
  if (input.errorCode === "PRIVATE") return "PRIVATE" as const;
  if (input.threadIncomplete || input.errorCode === "THREAD_OBSERVATION_FAILED" || input.errorCode === "THREAD_INCOMPLETE_WITHOUT_LINK") return "THREAD_INCOMPLETE" as const;
  if (input.errorCode === "LOGIN_OR_CHALLENGE" || input.errorCode === "X_TEMPORARY_ERROR") return "TEMP_ERROR" as const;
  return input.candidatesCount > 0 ? "FOUND_COMPLETE_THREAD" as const : "NO_MATCH_THIS_RUN" as const;
}
