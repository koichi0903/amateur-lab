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

  // The DB probe clamps each query to 100 assets. Split the candidate IDs into
  // matching-sized batches so large candidate pools are not silently left
  // unchecked before media eligibility runs.
  const safeBatchSize = Math.max(1, Math.min(100, Math.floor(batchSize) || 100));
  const probeStarted = Date.now();
  let checked = 0;
  let probeError: string | null = null;
  for (let offset = 0; offset < candidateWorkIds.length; offset += safeBatchSize) {
    const batch = candidateWorkIds.slice(offset, offset + safeBatchSize);
    const result = await probe(batch, safeBatchSize);
    checked += result.checked;
    if (result.error) {
      probeError = result.error;
      break;
    }
  }
  return {
    sync: syncResult,
    probe: { error: probeError, checked },
    syncElapsedMs,
    probeElapsedMs: Date.now() - probeStarted,
  };
}
