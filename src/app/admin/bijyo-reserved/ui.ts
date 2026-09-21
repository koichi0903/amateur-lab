export const UPCOMING_RELEASE_INITIAL_LIMIT = 24;
export const UPCOMING_RELEASE_PAGE_SIZE = 24;

export const BIJYO_SECTION_ORDER = ["today", "manual", "upcoming", "history"] as const;

export function visibleUpcomingReleaseCount(total: number, requested: number) {
  return Math.min(total, Math.max(UPCOMING_RELEASE_INITIAL_LIMIT, requested));
}
