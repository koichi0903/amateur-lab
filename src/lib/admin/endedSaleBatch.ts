export const ENDED_SALE_MAX_TARGETS_PER_RUN = 1000;

export function selectEndedSaleBatch<T>(targets: T[]): {
  batch: T[];
  hasMore: boolean;
} {
  const batch = targets.slice(0, ENDED_SALE_MAX_TARGETS_PER_RUN);
  return { batch, hasMore: targets.length > batch.length };
}
