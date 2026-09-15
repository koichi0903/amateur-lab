import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const expectedKey = process.env.SENTRY_TEST_KEY;
  const providedKey = request.nextUrl.searchParams.get("key");

  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  throw new Error("Sentry test error from amateur-lab");
}
