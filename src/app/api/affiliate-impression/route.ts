import { NextResponse } from "next/server";
import type { AffiliatePlacement } from "@/app/components/AffiliateLink";
import { normalizeAffiliateSource } from "@/lib/affiliateTracking";
import { normalizeCtaVariant } from "@/lib/ctaExperiment";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const experimentPlacements = new Set<AffiliatePlacement>([
  "detail-sidebar",
  "mobile-sticky",
]);

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workId = typeof payload === "object" && payload !== null && "workId" in payload
    ? Number(payload.workId)
    : Number.NaN;
  const placement = typeof payload === "object" && payload !== null && "placement" in payload
    ? payload.placement
    : null;
  const sourcePage = normalizeAffiliateSource(
    typeof payload === "object" && payload !== null && "sourcePage" in payload && typeof payload.sourcePage === "string"
      ? payload.sourcePage
      : null,
  );
  const ctaVariant = normalizeCtaVariant(
    typeof payload === "object" && payload !== null && "ctaVariant" in payload
      ? payload.ctaVariant
      : null,
  );

  if (
    !Number.isSafeInteger(workId) ||
    workId <= 0 ||
    typeof placement !== "string" ||
    !experimentPlacements.has(placement as AffiliatePlacement)
  ) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("affiliate_cta_impressions").insert({
    work_id: workId,
    placement,
    source_page: sourcePage,
    cta_variant: ctaVariant,
  });

  if (error) {
    console.error("[affiliate-impression] failed to record impression", {
      workId,
      placement,
      sourcePage,
      ctaVariant,
      code: error.code,
    });
  }

  return new NextResponse(null, { status: 204 });
}
