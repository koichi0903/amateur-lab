import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { JobName } from "./constants";

export async function finishJob(
  jobName: JobName
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
    })
    .eq("job_name", jobName);

  if (error) {
    throw error;
  }
}
