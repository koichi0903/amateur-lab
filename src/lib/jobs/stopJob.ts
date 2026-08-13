import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { JobName } from "./constants";

export async function stopJob(jobName?: JobName) {
  const stoppedAt = new Date().toISOString();
  let query = supabase
    .from("jobs")
    .update({
      status: "failed",
      error_message: "管理者が停止しました",
      finished_at: stoppedAt,
      updated_at: stoppedAt,
    })
    .eq("status", "running");

  if (jobName) query = query.eq("job_name", jobName);

  const { data, error } = await query.select("job_name");
  if (error) throw error;
  return data ?? [];
}
