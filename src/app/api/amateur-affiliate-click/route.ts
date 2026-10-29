import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HAKKUTSU_SITE_DMM_AFFILIATE_ID } from "@/lib/dmm/siteAffiliateUrl";

const sourcePages = new Set(["amateur", "amateur_detail"]);
const placements = new Set(["listing-card", "detail-sidebar"]);
const contentIdPattern = /^[A-Za-z0-9._-]{1,120}$/;

export async function POST(request: Request) {
  // Preview deployments share Production Supabase; never record preview clicks.
  if (process.env.VERCEL_ENV === "preview") {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const contentId = "contentId" in payload && typeof payload.contentId === "string"
    ? payload.contentId.trim()
    : "";
  const sourcePage = "sourcePage" in payload && typeof payload.sourcePage === "string"
    ? payload.sourcePage
    : "";
  const placement = "placement" in payload && typeof payload.placement === "string"
    ? payload.placement
    : "";

  if (
    !contentIdPattern.test(contentId) ||
    !sourcePages.has(sourcePage) ||
    !placements.has(placement)
  ) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("fanza_amateur_affiliate_clicks").insert({
      content_id: contentId,
      source_page: sourcePage,
      placement,
      affiliate_id: HAKKUTSU_SITE_DMM_AFFILIATE_ID,
    });
    if (error) {
      console.error("[amateur-affiliate-click] failed to record click", {
        contentId,
        sourcePage,
        placement,
        code: error.code,
      });
    }
  } catch (error) {
    console.error("[amateur-affiliate-click] request failed", {
      contentId,
      sourcePage,
      placement,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }

  // Measurement failures must not block a valid affiliate visit.
  return new NextResponse(null, { status: 204 });
}
