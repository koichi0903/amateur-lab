import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseXGrowthPostRegistrationInput } from "@/lib/xGrowthPostRegistration";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });

  const input = parseXGrowthPostRegistrationInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "HTTPSのX投稿URL（x.com/アカウント/status/投稿ID）を入力してください。" }, { status: 400 });
  }
  const { postKey, account, post } = input;

  const existingId = await supabaseAdmin
    .from("x_post_logs")
    .select("id,account_handle,post_key,work_id,posted_at,x_post_id")
    .eq("account_handle", account)
    .eq("x_post_id", post.id)
    .limit(1)
    .maybeSingle();
  if (existingId.error) return NextResponse.json({ error: "投稿IDの重複を確認できませんでした。" }, { status: 500 });
  if (existingId.data && existingId.data.post_key !== postKey) {
    return NextResponse.json({ error: "このX投稿IDは別の計測キーに登録済みです。" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("x_post_logs")
    .select("id,x_post_id")
    .eq("account_handle", account)
    .eq("post_key", postKey)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "計測キーに対応する投稿ログを確認できませんでした。" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "計測キーに対応する投稿ログがありません。" }, { status: 404 });
  if (data.x_post_id && data.x_post_id !== post.id) {
    return NextResponse.json({ error: "この計測キーには別のX投稿IDが登録済みです。" }, { status: 409 });
  }

  if (data.x_post_id === post.id) return NextResponse.json({ ok: true, unchanged: true });
  const update = await supabaseAdmin
    .from("x_post_logs")
    .update({ x_post_id: post.id })
    .eq("id", data.id)
    .eq("account_handle", account)
    .eq("post_key", postKey);
  if (update.error) return NextResponse.json({ error: "X投稿IDを保存できませんでした。" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
