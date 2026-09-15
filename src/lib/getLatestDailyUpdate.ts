import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function fetchLatestDailyUpdate() {
  const { data, error } = await supabaseAdmin
    .from("scheduled_update_runs")
    .select("finished_at")
    .eq("schedule_group", "daily-1030")
    .eq("status", "completed")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return error || !data?.finished_at ? null : data.finished_at;
}

export const getLatestDailyUpdate = unstable_cache(
  fetchLatestDailyUpdate,
  ["latest-daily-update"],
  { revalidate: 300, tags: ["latest-daily-update"] },
);
