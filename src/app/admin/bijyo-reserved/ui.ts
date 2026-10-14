export const UPCOMING_RELEASE_INITIAL_LIMIT = 24;
export const UPCOMING_RELEASE_PAGE_SIZE = 24;
export const BIJYO_RESERVED_QUEUE_PAGE_SIZE = 24;
export const HISTORY_PAGE_SIZE = 20;

export const BIJYO_SECTION_ORDER = ["manual", "upcoming", "reserved", "history"] as const;

export function visibleUpcomingReleaseCount(total: number, requested: number) {
  return Math.min(total, Math.max(UPCOMING_RELEASE_INITIAL_LIMIT, requested));
}

export function historyBlockStart(page: number) {
  return Math.max(0, page - 1) * HISTORY_PAGE_SIZE + 1;
}
