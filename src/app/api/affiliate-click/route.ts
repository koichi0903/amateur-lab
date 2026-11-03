import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseAffiliateClickPayload } from "@/lib/affiliateClickPayload";
import { isOperatorLandingPath } from "@/lib/externalAttribution";
import { insertAffiliateClickWithSchemaFallback } from "@/lib/affiliateClickPersistence";

export async function POST(request: Request) {
  // Preview deployments share the production Supabase project; never persist QA traffic.
  if (process.env.VERCEL_ENV === "preview") {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseAffiliateClickPayload(payload);
  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const { workId, placement, sourcePage, ctaVariant, xPostKey, externalAttribution } = event;
  if (isOperatorLandingPath(externalAttribution?.landingPath)) {
    return new NextResponse(null, { status: 204 });
  }

  const clickEvent = {
    work_id: workId,
    placement,
    source_page: sourcePage,
    cta_variant: ctaVariant,
    x_post_key: xPostKey,
    external_channel: externalAttribution?.channel,
    external_source: externalAttribution?.source,
    landing_path: externalAttribution?.landingPath,
  };

  const error = await insertAffiliateClickWithSchemaFallback(
    clickEvent,
    async (record) => await supabaseAdmin.from("affiliate_clicks").insert(record),
  );

  if (error) {
    const safeLogText = (value: string | null | undefined) =>
      typeof value === "string" ? value.slice(0, 240) : undefined;

    console.error("[affiliate-click] failed to record click", {
      workId,
      placement,
      sourcePage,
      ctaVariant,
      externalChannel: externalAttribution?.channel,
      code: error.code,
      message: safeLogText(error.message),
      details: safeLogText(error.details),
      hint: safeLogText(error.hint),
    });
    // Tracking must never turn a valid customer click into a UI error.
  }

  return new NextResponse(null, { status: 204 });
}
