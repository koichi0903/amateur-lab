import { supabase } from "@/lib/supabase";

export async function startJob(
  jobName: string,
  totalCount: number
) {
  const { error } = await supabase
    .from("jobs")
    .upsert({
      job_name: jobName,
      status: "running",
      processed_count: 0,
      total_count: totalCount,
      last_product_id: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      error_message: null,
    });

  if (error) {
    throw error;
  }
}