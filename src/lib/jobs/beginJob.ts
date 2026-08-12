import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { JobName } from "./constants";

export async function beginJob(
  jobName: JobName,
  totalCount: number
) {
  // 現在のジョブ取得
  const {
    data: job,
    error: selectError,
  } = await supabase
    .from("jobs")
    .select("*")
    .eq("job_name", jobName)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  // 初回実行
  if (!job) {
    const {
      data: newJob,
      error: insertError,
    } = await supabase
      .from("jobs")
      .insert({
        job_name: jobName,
        status: "running",
        processed_count: 0,
        total_count: totalCount,
        last_product_id: null,
        started_at: new Date().toISOString(),
        finished_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return newJob;
  }

  // 実行中なら途中再開
  if (job.status === "running") {
    return job;
  }

  // completed / failed は最初から開始
  const {
    data: restartedJob,
    error: updateError,
  } = await supabase
    .from("jobs")
    .update({
      status: "running",
      processed_count: 0,
      total_count: totalCount,
      last_product_id: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("job_name", jobName)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  return restartedJob;
}
