import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACCOUNTS = new Set(["hakkutsu_lab", "bijyo1010"]);

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const account = typeof payload?.account === "string" ? payload.account.trim().toLowerCase() : "";
  const postKey = typeof payload?.postKey === "string" ? payload.postKey.trim() : "";
  const workId = Number(payload?.workId);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const postText = typeof payload?.postText === "string" ? payload.postText.trim() : "";
  const postDate = typeof payload?.postDate === "string" ? payload.postDate.trim() : "";

  if (
    !ACCOUNTS.has(account) ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(postKey) ||
    !Number.isSafeInteger(workId) || workId <= 0 ||
    !title || title.length > 300 ||
    !postText || postText.length > 1000 ||
    !validDate(postDate)
  ) {
    return NextResponse.json({ error: "投稿タスクの内容が不正です。指示リンクを開き直してください。" }, { status: 400 });
  }

  const existing = await supabaseAdmin
    .from("x_post_logs")
    .select("id,account_handle,work_id,title,post_text")
    .eq("post_key", postKey)
    .eq("post_date", postDate)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: "投稿タスクの重複を確認できませんでした。" }, { status: 500 });
  if (existing.data) {
    if (existing.data.account_handle !== account || Number(existing.data.work_id) !== workId || existing.data.post_text !== postText) {
      return NextResponse.json({ error: "同じ計測キーに別の投稿記録があります。キーを作り直してください。" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, alreadyExists: true });
  }

  const now = new Date();
  const { error } = await supabaseAdmin.from("x_post_logs").insert({
    account_handle: account,
    post_key: postKey,
    work_id: workId,
    category: "deal",
    title: title.slice(0, 300),
    post_text: postText,
    post_date: postDate,
    posted_at: now.toISOString(),
    planned_at: now.toISOString(),
    scheduled_slot: "operator-directive",
    post_intent: "work_link",
    evaluation_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error("[operator-post-task] failed to save task", { postKey, account, code: error.code });
    return NextResponse.json({ error: "投稿タスクを保存できませんでした。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyExists: false });
}
