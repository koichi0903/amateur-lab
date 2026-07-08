import { supabase } from "@/lib/supabase";

export async function updateJob(
  jobName: string,
  processedCount: number,
  productId: string
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      processed_count: processedCount,
      last_product_id: productId,
    })
    .eq("job_name", jobName);

  if (error) {
    throw error;
  }
}