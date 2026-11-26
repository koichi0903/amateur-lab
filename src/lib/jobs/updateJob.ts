import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { JobName } from "./constants";
import { JobStoppedError } from "./JobStoppedError";

export async function updateJob(
  jobName: JobName,
  processedCount: number,
  productId: string,
  errorMessage?: string | null,
  totalCount?: number,
) {
  const updates: {
    processed_count: number;
    last_product_id: string;
    updated_at: string;
    error_message?: string | null;
    total_count?: number;
  } = {
    processed_count: processedCount,
    last_product_id: productId,
    updated_at: new Date().toISOString(),
  };
  if (errorMessage !== undefined) updates.error_message = errorMessage;
  if (totalCount !== undefined) updates.total_count = totalCount;

  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
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

