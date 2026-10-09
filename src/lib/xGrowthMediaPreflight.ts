export type CandidateMediaSyncResult = { error: string | null } & Record<string, unknown>;
export type CandidateMediaProbeResult = { error: string | null; checked: number };

/** Sync and probe the same candidate works before technical media eligibility runs. */
export async function syncAndProbeCandidateMedia<TSync extends CandidateMediaSyncResult>(
  workIds: number[],
  sync: (workIds: number[]) => Promise<TSync>,
  probe: (workIds: number[], batchSize: number) => Promise<CandidateMediaProbeResult>,
  batchSize = 100,
) {
  const candidateWorkIds = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const syncStarted = Date.now();
  const syncResult = await sync(candidateWorkIds);
  const syncElapsedMs = Date.now() - syncStarted;
  if (syncResult.error || candidateWorkIds.length === 0) {
    return {
      sync: syncResult,
      probe: { error: null, checked: 0 },
      syncElapsedMs,
      probeElapsedMs: 0,
    };
  }

  const probeStarted = Date.now();
  const probeResult = await probe(candidateWorkIds, batchSize);
  return {
    sync: syncResult,
    probe: probeResult,
    syncElapsedMs,
    probeElapsedMs: Date.now() - probeStarted,
  };
}
