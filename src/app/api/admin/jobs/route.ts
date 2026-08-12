import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("job_name,status,processed_count,total_count,last_product_id")
    .order("job_name");

  if (error) {
    console.error("Failed to load jobs", error);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }

  const productIds = [
    ...new Set(
      (jobs ?? [])
        .map((job) => job.last_product_id)
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
    jobs: (jobs ?? []).map((job) => ({
      ...job,
      last_product_title: job.last_product_id
        ? titleByProductId.get(job.last_product_id)
        : undefined,
    })),
  });
}
