import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { JobName } from "./constants";

export async function failJob(
  jobName: JobName,
  message: string
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    .eq("job_name", jobName);

  if (error) {
    throw error;
  }
}
