import { NextRequest, NextResponse } from "next/server";
import { syncSampleMovieAssets } from "@/lib/xGrowthOperations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { batchSize?: number };
  const result = await syncSampleMovieAssets(body.batchSize ?? 250);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
