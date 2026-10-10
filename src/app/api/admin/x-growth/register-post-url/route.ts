import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACCOUNTS = new Set(["hakkutsu_lab", "bijyo1010"]);

function parseXPostUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)\/?$/i);
    if (!match) return null;
    return { handle: match[1].toLowerCase(), id: match[2] };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const postKey = typeof payload?.postKey === "string" ? payload.postKey.trim() : "";
  const account = typeof payload?.account === "string" ? payload.account.toLowerCase() : "";
  const xPostUrl = typeof payload?.xPostUrl === "string" ? payload.xPostUrl.trim() : "";
  const post = parseXPostUrl(xPostUrl);
  if (!postKey || postKey.length > 180 || !ACCOUNTS.has(account) || !post || post.handle !== account) {
    return NextResponse.json({ error: "同じアカウントのX投稿URL（x.com/アカウント/status/投稿ID）を入力してください。" }, { status: 400 });
  }

  const existingId = await supabaseAdmin
    .from("x_post_logs")
    .select("account_handle,post_key")
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
