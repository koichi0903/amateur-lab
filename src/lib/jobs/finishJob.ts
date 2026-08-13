import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { JobName } from "./constants";
import { JobStoppedError } from "./JobStoppedError";

export async function finishJob(
  jobName: JobName
) {
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
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
