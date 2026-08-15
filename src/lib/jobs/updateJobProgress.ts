import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { JobName } from "./constants";
import { JobStoppedError } from "./JobStoppedError";
import { encodeJobProgress, type JobProgressDetail } from "./progress";

type UpdateJobProgressOptions = {
  processedCount: number;
  totalCount: number;
  detail: JobProgressDetail;
};

export async function updateJobProgress(
  jobName: JobName,
  { processedCount, totalCount, detail }: UpdateJobProgressOptions,
) {
  const { data, error } = await supabase
    .from("jobs")
    .update({
      processed_count: processedCount,
      total_count: totalCount,
      last_product_id: encodeJobProgress(detail),
      updated_at: new Date().toISOString(),
    })
    .eq("job_name", jobName)
    .eq("status", "running")
    .select("job_name")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new JobStoppedError(jobName);
}
