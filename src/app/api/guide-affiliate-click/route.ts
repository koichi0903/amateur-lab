import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HAKKUTSU_SITE_DMM_AFFILIATE_ID } from "@/lib/dmm/siteAffiliateUrl";

const GUIDE_CTA_KEYS: Record<string, ReadonlySet<string>> = {
  "fanza-live-chat": new Set(["inline", "bottom"]),
  "fanza-sale-timing": new Set(["bottom"]),
  "fanza-registration": new Set(["inline", "bottom"]),
  "fanza-vr-guide": new Set(["service-1", "bottom"]),
};

export async function POST(request: Request) {
  // Preview deployments share production Supabase; never persist QA traffic.
  if (process.env.VERCEL_ENV === "preview") {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const guideSlug =
    typeof payload === "object" && payload !== null && "guideSlug" in payload &&
    typeof payload.guideSlug === "string"
      ? payload.guideSlug
      : "";
  const ctaKey =
    typeof payload === "object" && payload !== null && "ctaKey" in payload &&
    typeof payload.ctaKey === "string"
      ? payload.ctaKey
      : "";

  if (!GUIDE_CTA_KEYS[guideSlug]?.has(ctaKey)) {
    return NextResponse.json({ error: "Invalid guide CTA" }, { status: 400 });
  }

  const requestId =
    typeof payload === "object" && payload !== null && "requestId" in payload &&
    typeof payload.requestId === "string"
      ? payload.requestId.slice(0, 80)
      : undefined;

  const { data, error } = await supabaseAdmin
    .from("affiliate_clicks")
    .insert({
      work_id: null,
      placement: "guide-cta",
      source_page: "guides",
      guide_slug: guideSlug,
      guide_cta_key: ctaKey,
      affiliate_id: HAKKUTSU_SITE_DMM_AFFILIATE_ID,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[guide-affiliate-click] failed to record click", {
      requestId,
      guideSlug,
      ctaKey,
      affiliateId: HAKKUTSU_SITE_DMM_AFFILIATE_ID,
      code: error.code,
      message: typeof error.message === "string" ? error.message.slice(0, 240) : undefined,
      details: typeof error.details === "string" ? error.details.slice(0, 240) : undefined,
      hint: typeof error.hint === "string" ? error.hint.slice(0, 240) : undefined,
    });

    // Keep outbound navigation working while returning a visible server failure
    // to fetch-based clients and preserving a diagnostic log for beacon requests.
    return NextResponse.json({ error: "Could not record guide CTA click" }, { status: 503 });
  }

  console.info("[guide-affiliate-click] recorded", {
    requestId,
    clickId: data.id,
    guideSlug,
    ctaKey,
    affiliateId: HAKKUTSU_SITE_DMM_AFFILIATE_ID,
  });

  // Tracking success must never delay the outbound affiliate link.
  return new NextResponse(null, { status: 204 });
}
