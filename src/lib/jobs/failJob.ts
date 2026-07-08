import { supabase } from "@/lib/supabase";

export async function failJob(
  jobName: string,
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