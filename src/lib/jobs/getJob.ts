import { supabase } from "@/lib/supabase";

export async function getJob(jobName: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("job_name", jobName)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}