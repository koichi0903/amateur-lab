import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { JobName } from "./constants";
import { JobStoppedError } from "./JobStoppedError";

export async function updateJob(
  jobName: JobName,
  processedCount: number,
  productId: string
) {
  const { data, error } = await supabase
    .from("jobs")
    .update({
      processed_count: processedCount,
      last_product_id: productId,
      updated_at: new Date().toISOString(),
    })
    .eq("job_name", jobName)
    .eq("status", "running")
    .select("job_name")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new JobStoppedError(jobName);
  }
}
