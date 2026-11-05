import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function retired() {
  return NextResponse.json({ error: "TikTok投稿経路は廃止されました。" }, { status: 410, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: NextRequest) {
  return retired();
}

export async function HEAD(_request: NextRequest) {
  return new NextResponse(null, { status: 410, headers: { "Cache-Control": "no-store" } });
}