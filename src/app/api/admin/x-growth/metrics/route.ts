import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "X APIによる閲覧数取得は停止中です。X Growth OSで投稿24時間後の表示数を手入力してください。" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
