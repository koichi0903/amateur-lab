import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { jstDateDaysAgo } from "@/lib/jstDate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DailyMetricInput = {
  reportDate: string;
  reportStatus: "provisional" | "confirmed";
  clickCount: number;
  directRewardCount: number;
  directRewardYen: number;
  categoryRewardCount: number;
  categoryRewardYen: number;
  serviceRewardCount: number;
  serviceRewardYen: number;
  notes: string;
};

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as Partial<DailyMetricInput> | null;
  if (!payload || typeof payload.reportDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.reportDate)) {
    return NextResponse.json({ error: "対象日を正しく選択してください。" }, { status: 400 });
  }
  // Validate the calendar date in UTC so JST midnight does not roll back to the prior UTC day.
  const parsedDate = new Date(`${payload.reportDate}T00:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== payload.reportDate) {
    return NextResponse.json({ error: "実在する日付を選択してください。" }, { status: 400 });
  }
  if (payload.reportDate > jstDateDaysAgo(1)) {
    return NextResponse.json({ error: "当日分は翌日反映のため、昨日以前の日付を選択してください。" }, { status: 400 });
  }
  if (payload.reportStatus !== "confirmed" && payload.reportStatus !== "provisional") {
    return NextResponse.json({ error: "確定状態を選択してください。" }, { status: 400 });
  }

  const numbers = [
    payload.clickCount,
    payload.directRewardCount,
    payload.directRewardYen,
    payload.categoryRewardCount,
    payload.categoryRewardYen,
    payload.serviceRewardCount,
    payload.serviceRewardYen,
  ];
  if (!numbers.every(isCount)) {
    return NextResponse.json({ error: "クリック数・成果件数・報酬額は0以上の整数で入力してください。" }, { status: 400 });
  }
  if (typeof payload.notes !== "string" || payload.notes.length > 500) {
    return NextResponse.json({ error: "メモは500文字以内で入力してください。" }, { status: 400 });
  }

  const observedAt = new Date().toISOString();
  const rows = [{
    report_date: payload.reportDate,
    affiliate_id: "990",
    click_count: payload.clickCount,
    direct_reward_count: payload.directRewardCount,
    direct_reward_yen: payload.directRewardYen,
    category_reward_count: payload.categoryRewardCount,
    category_reward_yen: payload.categoryRewardYen,
    service_reward_count: payload.serviceRewardCount,
    service_reward_yen: payload.serviceRewardYen,
    report_status: payload.reportStatus,
    capture_source: "manual_dmm_ui",
    notes: payload.notes.trim(),
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

  return NextResponse.json({ ok: true, reportDate: payload.reportDate, observedAt });
}
