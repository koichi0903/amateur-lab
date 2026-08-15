import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decodeJobProgress } from "@/lib/jobs/progress";

export async function GET() {
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select(
      "job_name,status,processed_count,total_count,last_product_id,error_message,started_at,finished_at",
    )
    .order("job_name");

  if (error) {
    console.error("Failed to load jobs", error);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }

  const jobsWithProgress = (jobs ?? []).map((job) => ({
    job,
    progress: decodeJobProgress(job.last_product_id),
  }));
  const productIds = [
    ...new Set(
      jobsWithProgress
        .map(({ job, progress }) => progress?.productId ?? job.last_product_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: works, error: worksError } = productIds.length
    ? await supabaseAdmin
        .from("works")
        .select("product_id,title")
        .in("product_id", productIds)
    : { data: [], error: null };

  if (worksError) {
    console.error("Failed to load job work titles", worksError);
  }

  const titleByProductId = new Map(
    (works ?? []).map((work) => [work.product_id, work.title]),
  );

  return NextResponse.json({
    jobs: jobsWithProgress.map(({ job, progress }) => ({
      ...job,
      last_product_id: progress?.productId ?? (progress ? null : job.last_product_id),
      progress_phase: progress?.phase,
      phase_processed: progress?.current,
      phase_total: progress?.total,
      last_product_title: (progress?.productId ?? job.last_product_id)
        ? titleByProductId.get(progress?.productId ?? job.last_product_id ?? "")
        : undefined,
    })),
  });
}
