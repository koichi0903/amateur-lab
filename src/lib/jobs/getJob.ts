import { supabase } from "@/lib/supabase";
import { JobName } from "./constants";

export async function getJob(
  jobName: JobName
) {
  const { data, error } = await supabase
    .from("jobs")
    .select("job_name,status,processed_count,total_count,last_product_id,error_message,started_at,finished_at,updated_at")
    .eq("job_name", jobName)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
