import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { completeOAuth, isSocialPlatform } from "@/lib/socialPublishingOAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { platform: rawPlatform } = await params;
  if (!isSocialPlatform(rawPlatform)) return NextResponse.json({ error: "Unknown publishing channel." }, { status: 404 });

  const errorCode = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const resultUrl = new URL("/admin/x-growth", request.url);
  const response = (ok: boolean) => {
    resultUrl.searchParams.set("social_connection", ok ? "connected" : "failed");
    resultUrl.searchParams.set("channel", rawPlatform);
    const result = NextResponse.redirect(resultUrl);
    result.cookies.set(`hakkutsu_social_oauth_${rawPlatform}`, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/admin/social-publishing/oauth",
      maxAge: 0,
    });
    return result;
  };

  if (errorCode || !code || !state) return response(false);
  try {
    await completeOAuth(request, rawPlatform, code, state);
    return response(true);
  } catch {
    return response(false);
  }
}
