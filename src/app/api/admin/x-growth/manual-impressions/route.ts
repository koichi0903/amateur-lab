import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACCOUNTS = new Set(["hakkutsu_lab", "bijyo1010"]);
const HOUR_MS = 60 * 60 * 1000;
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

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const postKey = typeof payload?.postKey === "string" ? payload.postKey.trim() : "";
  const account = typeof payload?.account === "string" ? payload.account : "";
  const impressions = payload?.impressions;
  if (!postKey || postKey.length > 180 || !ACCOUNTS.has(account)) {
    return NextResponse.json({ error: "投稿情報が正しくありません。画面を再読み込みしてください。" }, { status: 400 });
  }
  if (typeof impressions !== "number" || !Number.isSafeInteger(impressions) || impressions < 0 || impressions > 1_000_000_000) {
    return NextResponse.json({ error: "Xに表示された閲覧数を0以上の整数で入力してください。" }, { status: 400 });
  }

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
  const ageHours = (capturedAt.getTime() - Date.parse(post.posted_at)) / HOUR_MS;
  if (ageHours < 24) {
    return NextResponse.json({ error: `投稿からまだ${ageHours.toFixed(1)}時間です。24時間後に記録してください。` }, { status: 400 });
  }
  if (ageHours >= 27) {
    return NextResponse.json({ error: `投稿から${ageHours.toFixed(1)}時間経過しています。24時間時点の記録期限（24〜27時間）を過ぎています。今回は未取得として残します。` }, { status: 400 });
  }

  const existing = await supabaseAdmin
    .from("x_metric_snapshots")
    .select("id,source")
    .eq("post_key", postKey)
    .eq("snapshot_age", "24h")
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: "既存の記録を確認できませんでした。" }, { status: 500 });
  if (existing.data && existing.data.source !== "manual") {
    return NextResponse.json({ error: "すでに別の方法で記録されています。上書きしませんでした。" }, { status: 409 });
  }

  const postedAt = new Date(post.posted_at);
  const windowEnd = new Date(postedAt.getTime() + 24 * HOUR_MS).toISOString();
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
  const saveResult = await supabaseAdmin.from("x_metric_snapshots").upsert(rows as never[], { onConflict: "post_key,snapshot_age" });
  if (saveResult.error) return NextResponse.json({ error: "記録を保存できませんでした。" }, { status: 500 });

  return NextResponse.json({ ok: true, capturedAt: capturedAt.toISOString(), ageHours: Number(ageHours.toFixed(2)) });
}
