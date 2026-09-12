import { NextRequest, NextResponse } from "next/server";
import { updateMediaAssetTrim } from "@/lib/xGrowthOperations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    id?: number;
    trimStartSeconds?: number;
    trimNote?: string;
    trimModifyConfirmed?: boolean;
  };
  if (!Number.isSafeInteger(body.id)) {
    return NextResponse.json({ error: "asset idが不正です。" }, { status: 400 });
  }
  const result = await updateMediaAssetTrim({
    id: body.id as number,
    trimStartSeconds: Number(body.trimStartSeconds ?? 0),
    trimNote: body.trimNote,
    trimModifyConfirmed: body.trimModifyConfirmed,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, trimStartSeconds: result.trimStartSeconds });
}
