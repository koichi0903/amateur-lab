import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  return NextResponse.json({ error: "X APIによる閲覧数取得は停止中です。X Growth OSで投稿24時間後の表示数を手入力してください。" }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
