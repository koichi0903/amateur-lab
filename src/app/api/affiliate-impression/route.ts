import { NextResponse } from "next/server";
import { parseAffiliateImpressionPayload } from "@/lib/affiliateImpressionPayload";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isMissingXPostKey(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || error.message?.includes("x_post_key");
}

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

  const event = parseAffiliateImpressionPayload(payload);
  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  const { workId, placement, sourcePage, ctaVariant, xPostKey } = event;

  let { error } = await supabaseAdmin.from("affiliate_cta_impressions").insert({
    work_id: workId,
    placement,
    source_page: sourcePage,
    cta_variant: ctaVariant,
    x_post_key: xPostKey,
  });

  if (error && isMissingXPostKey(error)) {
    const fallback = await supabaseAdmin.from("affiliate_cta_impressions").insert({
      work_id: workId,
      placement,
      source_page: sourcePage,
      cta_variant: ctaVariant,
    });
    error = fallback.error;
  }

  if (error) {
    console.error("[affiliate-impression] failed to record impression", {
      workId,
      placement,
      sourcePage,
      ctaVariant,
      xPostKey,
      code: error.code,
    });
  }

  return new NextResponse(null, { status: 204 });
}
