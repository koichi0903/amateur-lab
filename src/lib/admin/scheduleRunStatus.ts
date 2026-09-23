export const SCHEDULE_RUN_STALE_AFTER_MS = 15 * 60 * 1000;

export type ScheduleRunStatus = "running" | "completed" | "failed" | "skipped" | "stale";

export type ScheduleRunLike = {
  status: Exclude<ScheduleRunStatus, "stale">;
  started_at: string | null;
  heartbeat_at?: string | null;
};

export function isScheduleRunStale(
  run: ScheduleRunLike,
  now = Date.now(),
): boolean {
  if (run.status !== "running") return false;

  const lastActivity = run.heartbeat_at ?? run.started_at;
  const lastActivityMs = lastActivity ? Date.parse(lastActivity) : Number.NaN;
  return !Number.isFinite(lastActivityMs) || now - lastActivityMs > SCHEDULE_RUN_STALE_AFTER_MS;
}

export function getEffectiveScheduleRunStatus(
  run: ScheduleRunLike,
  now = Date.now(),
): ScheduleRunStatus {
  return isScheduleRunStale(run, now) ? "stale" : run.status;
}
