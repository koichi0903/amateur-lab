import { NextResponse } from "next/server";
import { recordManualXPost } from "@/lib/xGrowthOperations";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const xPostUrl = typeof payload?.xPostUrl === "string" ? payload.xPostUrl.trim() : "";
  const match = xPostUrl.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)(?:[/?#].*)?$/i);
  if (!match) return NextResponse.json({ error: "作品ページのリンクを含むXポスト（自己リプにリンクした場合は自己リプ）のURLを入力してください。" }, { status: 400 });
  const result = await recordManualXPost({
    workId: Number(payload?.workId), candidateId: typeof payload?.candidateId === "string" ? payload.candidateId : null,
    slotId: typeof payload?.slotId === "string" ? payload.slotId : null, candidateRank: typeof payload?.candidateRank === "string" ? payload.candidateRank : null,
    slotRole: typeof payload?.slotRole === "string" ? payload.slotRole : null, title: typeof payload?.title === "string" ? payload.title : "FANZA X Growth投稿",
    postText: typeof payload?.postText === "string" ? payload.postText : "", intent: typeof payload?.intent === "string" ? payload.intent : null,
    xPostId: match[1],
    trackingUrl: typeof payload?.trackingUrl === "string" ? payload.trackingUrl : null,
    mediaAssetId: Number.isSafeInteger(Number(payload?.mediaAssetId)) ? Number(payload?.mediaAssetId) : null,
    linkStrategy: typeof payload?.linkStrategy === "string" ? payload.linkStrategy : null,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
