import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { createOAuthRedirect, isSocialPlatform } from "@/lib/socialPublishingOAuth";
import { isSocialTokenEncryptionConfigured, isTikTokAutoPublishingConfigured } from "@/lib/socialPublishingReadiness";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { platform: rawPlatform } = await params;
  if (!isSocialPlatform(rawPlatform)) return NextResponse.json({ error: "Unknown publishing channel." }, { status: 404 });
  if (rawPlatform === "tiktok" && !isTikTokAutoPublishingConfigured()) return NextResponse.json({ error: "TikTok Direct Post is unavailable from this internal-only admin tool. No TikTok OAuth connection can be started here." }, { status: 409 });
  if (!isSocialTokenEncryptionConfigured()) return NextResponse.json({ error: "A valid 32-byte token encryption key is not configured." }, { status: 503 });
  try {
    const result = createOAuthRedirect(request, rawPlatform);
    const response = NextResponse.redirect(result.url);
    response.cookies.set(result.cookieName, result.cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/admin/social-publishing/oauth",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "OAuth is not configured." }, { status: 503 });
  }
}
