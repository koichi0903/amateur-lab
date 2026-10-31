import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HAKKUTSU_SITE_DMM_AFFILIATE_ID } from "@/lib/dmm/siteAffiliateUrl";
import { parseAmateurAffiliateClickPayload } from "@/lib/amateurAffiliateClickPayload";

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

  const event = parseAmateurAffiliateClickPayload(payload);
  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("fanza_amateur_affiliate_clicks").insert({
      content_id: event.contentId,
      source_page: event.sourcePage,
      placement: event.placement,
      affiliate_id: HAKKUTSU_SITE_DMM_AFFILIATE_ID,
    });
    if (error) {
      console.error("[amateur-affiliate-click] failed to record click", {
        contentId: event.contentId,
        sourcePage: event.sourcePage,
        placement: event.placement,
        code: error.code,
      });
    }
  } catch (error) {
    console.error("[amateur-affiliate-click] request failed", {
      contentId: event.contentId,
      sourcePage: event.sourcePage,
      placement: event.placement,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }

  // Measurement failures must not block a valid affiliate visit.
  return new NextResponse(null, { status: 204 });
}
