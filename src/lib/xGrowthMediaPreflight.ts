export type CandidateMediaSyncResult = { error: string | null } & Record<string, unknown>;

/** Persist official sample URL metadata before candidate eligibility runs. */
export async function syncCandidateMediaAssets<TSync extends CandidateMediaSyncResult>(
  workIds: number[],
  sync: (workIds: number[]) => Promise<TSync>,
) {
  const candidateWorkIds = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const syncStarted = Date.now();
  const syncResult = await sync(candidateWorkIds);
  const syncElapsedMs = Date.now() - syncStarted;
  return {
    sync: syncResult,
    syncElapsedMs,
  };
}
