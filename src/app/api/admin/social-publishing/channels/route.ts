import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMissingSocialPublishingScopes, isSocialPlatform } from "@/lib/socialPublishingOAuth";
import { assertPrivateSocialPublishingBucket } from "@/lib/socialPublishingMedia";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.nextUrl.searchParams.has("tiktokInfo")) return NextResponse.json({ error: "TikTok運用は廃止されました。" }, { status: 410 });
  return NextResponse.json({ error: "Unsupported channel query." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Same-origin channel changes are required." }, { status: 403 });
  }
  const payload = await request.json().catch(() => null) as { id?: unknown; enabled?: unknown } | null;
  if (typeof payload?.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id) || typeof payload.enabled !== "boolean") {
    return NextResponse.json({ error: "A channel id and enabled boolean are required." }, { status: 400 });
  }
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("social_publishing_channels")
    .select("id, platform, scopes")
    .eq("id", payload.id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not verify the channel." }, { status: 503 });
  if (!existing) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  if (existing.platform === "tiktok" && payload.enabled) return NextResponse.json({ error: "TikTok運用は廃止されました。" }, { status: 410 });
  if (payload.enabled) {
    try {
      await assertPrivateSocialPublishingBucket();
    } catch {
      return NextResponse.json({ error: "Channel publishing stays disabled until the media bucket is verified as private." }, { status: 409 });
    }
  }
  if (payload.enabled && isSocialPlatform(existing.platform)) {
    const missingScopes = getMissingSocialPublishingScopes(existing.platform, Array.isArray(existing.scopes) ? existing.scopes : []);
    if (missingScopes.length > 0) {
      return NextResponse.json({ error: "The provider did not confirm all required publishing permissions. Reconnect the account after the app grants them.", missingScopes }, { status: 409 });
    }
  }
  const { data, error } = await supabaseAdmin
    .from("social_publishing_channels")
    .update({ enabled: payload.enabled, updated_at: new Date().toISOString() })
    .eq("id", payload.id)
    .select("id, platform, account_label, enabled")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update channel state." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  return NextResponse.json({ channel: data }, { headers: { "Cache-Control": "no-store" } });
}
