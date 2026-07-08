import { supabase } from "@/lib/supabase";
import { JobName } from "./constants";

export async function startJob(
  jobName: JobName,
  totalCount: number
) {
  const { error } = await supabase
    .from("jobs")
    .upsert(
      {
        job_name: jobName,
        status: "running",
        processed_count: 0,
        total_count: totalCount,
        last_product_id: null,
        started_at: new Date().toISOString(),
        finished_at: null,
        error_message: null,
      },
      {
        onConflict: "job_name",
      }
    );

  if (error) {
    throw error;
  }
}