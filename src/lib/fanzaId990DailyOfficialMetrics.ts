import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jstDateDaysAgo } from "@/lib/jstDate";

export type FanzaId990DailyOfficialMetric = {
  report_date: string;
  affiliate_id: "990";
  click_count: number;
  direct_reward_count: number;
  direct_reward_yen: number;
  category_reward_count: number;
  category_reward_yen: number;
  service_reward_count: number;
  service_reward_yen: number;
  report_status: "provisional" | "confirmed";
  capture_source: "manual_dmm_ui" | "manual_csv";
  notes: string;
  observed_at: string;
  updated_at: string;
};

export async function getFanzaId990DailyOfficialMetrics(days = 30) {
  const evaluatedAt = new Date().toISOString();
  const fromDate = jstDateDaysAgo(Math.max(1, days - 1), new Date(evaluatedAt));
  const untilDate = jstDateDaysAgo(1, new Date(evaluatedAt));
  const { data, error } = await supabaseAdmin
    .from("fanza_id990_daily_official_metrics")
    .select("report_date,affiliate_id,click_count,direct_reward_count,direct_reward_yen,category_reward_count,category_reward_yen,service_reward_count,service_reward_yen,report_status,capture_source,notes,observed_at,updated_at")
    .gte("report_date", fromDate)
    .lte("report_date", untilDate)
    .order("report_date", { ascending: false })
    .limit(60);

  if (error) return { rows: [] as FanzaId990DailyOfficialMetric[], error: error.message, evaluatedAt, fromDate, untilDate };
  return {
    rows: (data ?? []) as FanzaId990DailyOfficialMetric[],
    error: null,
    evaluatedAt,
    fromDate,
    untilDate,
  };
}
