import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { JobName } from "./constants";

export async function updateJob(
  jobName: JobName,
  processedCount: number,
  productId: string
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      processed_count: processedCount,
      last_product_id: productId,
      updated_at: new Date().toISOString(),
    })
    .eq("job_name", jobName);

  if (error) {
    throw error;
  }
}
