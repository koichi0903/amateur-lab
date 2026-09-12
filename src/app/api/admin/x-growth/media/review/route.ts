import { NextRequest, NextResponse } from "next/server";
import { reviewMediaAsset } from "@/lib/xGrowthOperations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    id?: number;
    status?: "review" | "allowed" | "blocked";
    rightsBasisType?: string;
    rightsBasisUrl?: string;
    rightsBasisNote?: string;
    mediaQuality?: "unreviewed" | "strong" | "normal" | "weak";
    manualTags?: string[];
    reviewSource?: string;
  };
  if (!Number.isSafeInteger(body.id) || !body.status) {
    return NextResponse.json({ error: "id/statusが不正です。" }, { status: 400 });
  }
  const result = await reviewMediaAsset({
    id: body.id as number,
    status: body.status,
    rightsBasisType: body.rightsBasisType,
    rightsBasisUrl: body.rightsBasisUrl,
    rightsBasisNote: body.rightsBasisNote,
    mediaQuality: body.mediaQuality,
    manualTags: body.manualTags,
    reviewSource: body.reviewSource,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
