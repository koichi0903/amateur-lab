export const UPCOMING_RELEASE_INITIAL_LIMIT = 24;
export const UPCOMING_RELEASE_PAGE_SIZE = 24;
export const MANUAL_CANDIDATE_INITIAL_LIMIT = 24;
export const MANUAL_CANDIDATE_PAGE_SIZE = 24;

export const BIJYO_SECTION_ORDER = ["today", "manual", "upcoming", "history"] as const;

export function visibleUpcomingReleaseCount(total: number, requested: number) {
  return Math.min(total, Math.max(UPCOMING_RELEASE_INITIAL_LIMIT, requested));
}

export function visibleManualCandidateCount(total: number, requested: number) {
  return Math.min(total, Math.max(MANUAL_CANDIDATE_INITIAL_LIMIT, requested));
}
