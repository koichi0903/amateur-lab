import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { operatorPostTaskConflict, validateOperatorPostTask } from "@/lib/x-growth/xGrowthOperatorPostTask";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as unknown;
  const validation = validateOperatorPostTask(payload);
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { account, postKey, workId, title, postText, postDate } = validation;

  const existing = await supabaseAdmin
    .from("x_post_logs")
    .select("id,account_handle,work_id,title,post_text")
    .eq("post_key", postKey)
    .eq("post_date", postDate)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: "投稿タスクの重複を確認できませんでした。" }, { status: 500 });
  if (existing.data) {
    const conflict = operatorPostTaskConflict(existing.data, { account, workId, postText });
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
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
