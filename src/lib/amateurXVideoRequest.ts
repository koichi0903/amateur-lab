export type AmateurXVideoRequest = {
  jobId: number;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
};

export function parseAmateurXVideoRequest(searchParams: URLSearchParams):
  | { ok: true; value: AmateurXVideoRequest }
  | { ok: false } {
  const jobId = Number(searchParams.get("jobId"));
  const trimStartSeconds = Number(searchParams.get("trimStart") ?? 0);
  const rawTrimEnd = searchParams.get("trimEnd");
  const trimEndSeconds = rawTrimEnd === null || !rawTrimEnd.trim() ? null : Number(rawTrimEnd);

  if (!Number.isSafeInteger(jobId) || jobId <= 0) return { ok: false };
  if (!Number.isFinite(trimStartSeconds) || trimStartSeconds < 0 || trimStartSeconds > 600) return { ok: false };
  if (trimEndSeconds !== null && (!Number.isFinite(trimEndSeconds) || trimEndSeconds <= trimStartSeconds)) return { ok: false };

  return { ok: true, value: { jobId, trimStartSeconds, trimEndSeconds } };
}
