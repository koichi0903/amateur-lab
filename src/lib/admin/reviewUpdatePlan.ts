export type ReviewUpdateOptions = {
  maxItems?: number;
  timeBudgetMs?: number;
};

export type ReviewPageState = "continue" | "paused" | "complete";

export function createReviewUpdatePlan(
  initialProcessedCount: number,
  options: ReviewUpdateOptions,
  now: () => number = () => Date.now(),
) {
  const maxItems = options.maxItems === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(1, options.maxItems);

  return {
    targetEnd: initialProcessedCount + maxItems,
    deadline: options.timeBudgetMs && options.timeBudgetMs > 0
      ? now() + options.timeBudgetMs
      : null,
  };
}

export function shouldStopReviewUpdateForDeadline(
  current: number,
  initialProcessedCount: number,
  deadline: number | null,
  now: () => number = () => Date.now(),
) {
  return current > initialProcessedCount && deadline !== null && now() >= deadline;
}

export function resolveReviewPageState(
  processedCount: number,
  pageEnd: number,
  targetCount: number,
  requestedCount: number,
): ReviewPageState {
  if (processedCount < pageEnd) return "paused";
  if (targetCount < requestedCount) return "complete";
  return "continue";
}
