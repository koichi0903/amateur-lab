import type { JobProgressDetail } from "@/lib/jobs/progress";

type JobProgressRow = { last_product_id: string | null };

export type JobWithProgress<T extends JobProgressRow> = {
  job: T;
  progress: JobProgressDetail | null;
};

export function getJobProgressProductIds<T extends JobProgressRow>(
  jobsWithProgress: JobWithProgress<T>[],
) {
  return [
    ...new Set(
      jobsWithProgress
        .map(({ job, progress }) => progress?.productId ?? job.last_product_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

export function projectAdminJobProgress<T extends JobProgressRow>(
  job: T,
  progress: JobProgressDetail | null,
  titleByProductId: ReadonlyMap<string, string | null>,
) {
  const titleProductId = progress?.productId ?? job.last_product_id;

  return {
    ...job,
    last_product_id: progress?.productId ?? (progress ? null : job.last_product_id),
    progress_phase: progress?.phase,
    phase_processed: progress?.current,
    phase_total: progress?.total,
    last_product_title: titleProductId
      ? titleByProductId.get(titleProductId)
      : undefined,
  };
}
