export type BijyoManualTrimRequest = {
  jobId: number;
  workId?: number;
  mode: "auto" | "manual";
  trimStartSeconds: unknown;
};

export function parseBijyoManualTrimRequest(
  body: Record<string, unknown>,
  jobId: number,
  workId: number,
): { ok: true; value: BijyoManualTrimRequest } | { ok: false; error: string } {
  if (!Number.isSafeInteger(jobId) || jobId <= 0) return { ok: false, error: "jobIdが不正です。" };
  if (workId !== 0 && (!Number.isSafeInteger(workId) || workId <= 0)) return { ok: false, error: "workIdが不正です。" };
  return {
    ok: true,
    value: {
      jobId,
      workId: workId > 0 ? workId : undefined,
      mode: body.mode === "resetAuto" ? "auto" : "manual",
      trimStartSeconds: body.trimStartSeconds,
    },
  };
}

export function bijyoManualTrimErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return 500;
  return Number((error as { status?: unknown }).status) === 400 ? 400 : 500;
}

export function bijyoTrimSecondsFromFilename(filename: string) {
  return Number(filename.match(/trim-(\d+(?:\.\d+)?)s/)?.[1] ?? 0);
}
