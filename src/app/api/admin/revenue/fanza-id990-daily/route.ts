import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { jstDateDaysAgo } from "@/lib/jstDate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateDailyMetricInput } from "./validateInput";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const validation = validateDailyMetricInput(payload, jstDateDaysAgo(1));
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  const observedAt = new Date().toISOString();
  const rows = [{
    report_date: input.reportDate,
    affiliate_id: "990",
    click_count: input.clickCount,
    direct_reward_count: input.directRewardCount,
    direct_reward_yen: input.directRewardYen,
    category_reward_count: input.categoryRewardCount,
    category_reward_yen: input.categoryRewardYen,
    service_reward_count: input.serviceRewardCount,
    service_reward_yen: input.serviceRewardYen,
    report_status: input.reportStatus,
    capture_source: "manual_dmm_ui",
    notes: input.notes.trim(),
    observed_at: observedAt,
    updated_at: observedAt,
  }];

  // The generated Supabase type does not yet include this new table.
  const { error } = await supabaseAdmin
    .from("fanza_id990_daily_official_metrics")
    .upsert(rows as never[], { onConflict: "report_date" });
  if (error) {
    console.error("FANZA ID990 daily official metric save failed", error);
    return NextResponse.json({ error: "公式日次データを保存できませんでした。テーブル設定と通信状態を確認してください。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reportDate: input.reportDate, observedAt });
}
