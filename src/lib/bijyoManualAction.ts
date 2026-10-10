export type BijyoManualActionDependencies<TAdd = unknown, TPrepare = unknown> = {
  createManualJob: (workId: number) => Promise<TAdd>;
  prepareVideo: (jobId: number, workId?: number) => Promise<TPrepare>;
};

export function executeBijyoManualAction<TAdd, TPrepare>(action: "manual", ids: { workId?: number; jobId?: number }, dependencies: BijyoManualActionDependencies<TAdd, TPrepare>): Promise<TAdd>;
export function executeBijyoManualAction<TAdd, TPrepare>(action: "prepareVideo", ids: { workId?: number; jobId?: number }, dependencies: BijyoManualActionDependencies<TAdd, TPrepare>): Promise<TPrepare>;
export function executeBijyoManualAction<TAdd, TPrepare>(action: string, ids: { workId?: number; jobId?: number }, dependencies: BijyoManualActionDependencies<TAdd, TPrepare>): Promise<TAdd | TPrepare | null>;
export async function executeBijyoManualAction<TAdd, TPrepare>(
  action: string,
  ids: { workId?: number; jobId?: number },
  dependencies: BijyoManualActionDependencies<TAdd, TPrepare>,
) {
  if (action === "manual") {
    if (!Number.isSafeInteger(ids.workId) || (ids.workId ?? 0) <= 0) throw new Error("workIdが不正です。");
    return dependencies.createManualJob(ids.workId!);
  }
  if (action === "prepareVideo") {
    if (!Number.isSafeInteger(ids.jobId) || (ids.jobId ?? 0) <= 0) throw new Error("jobIdが不正です。");
    if (ids.workId !== undefined && (!Number.isSafeInteger(ids.workId) || ids.workId <= 0)) throw new Error("workIdが不正です。");
    return dependencies.prepareVideo(ids.jobId!, ids.workId);
  }
  return null;
}
