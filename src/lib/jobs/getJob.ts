import { supabase } from "@/lib/supabase";
import { JobName } from "./constants";

export async function getJob(
  jobName: JobName
) {
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