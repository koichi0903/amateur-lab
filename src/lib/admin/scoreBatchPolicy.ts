export function shouldFlushScoreBatch(
  updatesCount: number,
  batchSize: number,
  isLastTarget: boolean,
): boolean {
  return updatesCount === batchSize || (isLastTarget && updatesCount > 0);
}
