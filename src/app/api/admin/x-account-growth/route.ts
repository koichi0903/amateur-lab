import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").normalize("NFKC").trim();
}

function intValue(formData: FormData, name: string) {
  const value = Number(text(formData, name).replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const accountHandle = text(formData, "account_handle") || "hakkutsu_lab";
    const metricDate = text(formData, "metric_date");
    if (!/^[a-zA-Z0-9_]{1,32}$/.test(accountHandle)) {
      return NextResponse.json({ error: "アカウント名が不正です。" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) {
      return NextResponse.json({ error: "週の終了日を選択してください。" }, { status: 400 });
    }

    const followingInput = text(formData, "following_count");
    const { data, error } = await supabaseAdmin
      .from("fanza_x_account_metrics")
      .upsert({
        account_handle: accountHandle,
        metric_date: metricDate,
        followers_count: intValue(formData, "followers_count"),
        following_count: followingInput ? intValue(formData, "following_count") : null,
        profile_visits: intValue(formData, "profile_visits"),
        total_impressions: intValue(formData, "total_impressions"),
        posts_count: intValue(formData, "posts_count"),
        likes: intValue(formData, "likes"),
        reposts: intValue(formData, "reposts"),
        replies: intValue(formData, "replies"),
        fanza_clicks: intValue(formData, "fanza_clicks"),
        sales_count: intValue(formData, "sales_count"),
        commission_amount: intValue(formData, "commission_amount"),
        notes: text(formData, "notes"),
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_handle,metric_date", ignoreDuplicates: false })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("FANZA X account growth save failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Xアカウント成長の保存に失敗しました。" },
      { status: 500 },
    );
  }
}
