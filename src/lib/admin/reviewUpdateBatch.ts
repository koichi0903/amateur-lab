export type ReviewUpdateOutcome = "success" | "skip" | "failed";
export type ReviewBatchTarget = { product_id: string };

export type ReviewBatchSummary = {
  success: number;
  skip: number;
  failed: number;
  workIds: string[];
  skippedWorkIds: string[];
  unresolvedFailures: string[];
};

export async function processReviewBatch<T extends ReviewBatchTarget>(
  batch: T[],
  updateOne: (work: T) => Promise<ReviewUpdateOutcome>,
): Promise<ReviewBatchSummary> {
  const firstResults = await Promise.all(batch.map(updateOne));
  const retryTargets = batch.filter((_, resultIndex) => firstResults[resultIndex] !== "success");
  const retryResults = retryTargets.length > 0
    ? await Promise.all(retryTargets.map(updateOne))
    : [];
  const retryResultMap = new Map<string, ReviewUpdateOutcome>();
  retryTargets.forEach((work, retryIndex) => retryResultMap.set(work.product_id, retryResults[retryIndex]));

  let success = 0;
  let skip = 0;
  let failed = 0;
  const workIds: string[] = [];
  const skippedWorkIds: string[] = [];
  const unresolvedFailures: string[] = [];

  for (let resultIndex = 0; resultIndex < batch.length; resultIndex++) {
    const work = batch[resultIndex];
    const firstResult = firstResults[resultIndex];
    const finalResult = firstResult === "success"
      ? firstResult
      : retryResultMap.get(work.product_id) ?? firstResult;

    if (finalResult === "success") {
      success++;
      workIds.push(work.product_id);
    } else if (finalResult === "skip") {
      skip++;
      skippedWorkIds.push(work.product_id);
    } else {
      failed++;
      unresolvedFailures.push(work.product_id);
    }
  }

  return { success, skip, failed, workIds, skippedWorkIds, unresolvedFailures };
}
