import { supabase } from "@/lib/supabase";

export async function finishJob(
  jobName: string
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