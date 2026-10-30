import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  existingManualSnapshotConflict,
  validateManualImpressionPayload,
  validateManualPostAge,
} from "@/lib/xGrowthManualImpressions";

type ManualSnapshotInsert = {
  account_handle: string;
  x_post_log_id: number;
  post_key: string;
  snapshot_age: "24h";
  captured_at: string;
  source: "manual";
  impressions: number;
  site_visits: number;
  affiliate_clicks: number;
  notes: string;
};

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });

  const payload = await request.json().catch(() => null) as unknown;
  const payloadValidation = validateManualImpressionPayload(payload);
  if ("error" in payloadValidation) return NextResponse.json({ error: payloadValidation.error }, { status: 400 });
  const { postKey, account, impressions } = payloadValidation;

  const postResult = await supabaseAdmin
    .from("x_post_logs")
    .select("id,account_handle,post_key,posted_at,x_post_id")
    .eq("account_handle", account)
    .eq("post_key", postKey)
    .not("x_post_id", "is", null)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (postResult.error) return NextResponse.json({ error: "投稿記録を確認できませんでした。" }, { status: 500 });
  const post = postResult.data as { id: number; account_handle: string; post_key: string; posted_at: string; x_post_id: string } | null;
  if (!post) return NextResponse.json({ error: "X投稿IDが登録されていません。投稿URLを保存した投稿だけ記録できます。" }, { status: 404 });

  const capturedAt = new Date();
  const ageValidation = validateManualPostAge(post.posted_at, capturedAt);
  if ("error" in ageValidation) return NextResponse.json({ error: ageValidation.error }, { status: 400 });
  const { ageHours } = ageValidation;

  const existing = await supabaseAdmin
    .from("x_metric_snapshots")
    .select("id,source,account_handle")
    .eq("post_key", postKey)
    .eq("snapshot_age", "24h")
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: "既存の記録を確認できませんでした。" }, { status: 500 });
  const snapshotConflict = existingManualSnapshotConflict(existing.data, account);
  if (snapshotConflict) return NextResponse.json({ error: snapshotConflict }, { status: 409 });

  const postedAt = new Date(post.posted_at);
  const windowEnd = capturedAt.toISOString();
  const [views, clicks] = await Promise.all([
    supabaseAdmin.from("work_page_views").select("id", { count: "exact", head: true }).eq("source_page", "x").eq("x_post_key", postKey).gte("viewed_at", postedAt.toISOString()).lte("viewed_at", windowEnd),
    supabaseAdmin.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("source_page", "x").eq("x_post_key", postKey).gte("clicked_at", postedAt.toISOString()).lte("clicked_at", windowEnd),
  ]);
  const countError = views.error ?? clicks.error;
  if (countError) return NextResponse.json({ error: "サイト側の24時間イベントを確認できませんでした。もう一度お試しください。" }, { status: 500 });

  const rows: ManualSnapshotInsert[] = [];
  rows.push({
    account_handle: account,
    x_post_log_id: post.id,
    post_key: postKey,
    snapshot_age: "24h",
    captured_at: capturedAt.toISOString(),
    source: "manual",
    impressions,
    site_visits: views.count ?? 0,
    affiliate_clicks: clicks.count ?? 0,
    notes: `X画面の閲覧数を手入力。投稿から${ageHours.toFixed(2)}時間後に取得。X APIは使用していません。`,
  });
  // The generated Supabase type has not yet declared this existing table.
  const saveResult = await supabaseAdmin
    .from("x_metric_snapshots")
    .upsert(rows as never[], { onConflict: "post_key,snapshot_age" })
    .select("id,account_handle,post_key,snapshot_age,captured_at,impressions,site_visits,affiliate_clicks")
    .single();
  if (saveResult.error || !saveResult.data) return NextResponse.json({ error: "記録を保存できませんでした。保存結果を確認できないため、再読み込みして状態を確認してください。" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    capturedAt: saveResult.data.captured_at,
    ageHours: Number(ageHours.toFixed(2)),
    impressions: saveResult.data.impressions,
    siteVisits: saveResult.data.site_visits,
    affiliateClicks: saveResult.data.affiliate_clicks,
  });
}
