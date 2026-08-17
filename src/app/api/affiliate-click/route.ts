import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AffiliatePlacement } from "@/app/components/AffiliateLink";
import { normalizeAffiliateSource } from "@/lib/affiliateTracking";
import { normalizeCtaVariant } from "@/lib/ctaExperiment";

const placements = new Set<AffiliatePlacement>([
  "detail-sidebar",
  "mobile-sticky",
  "compare-card",
]);

function isMissingCtaVariant(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || error.message?.includes("cta_variant");
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workId =
    typeof payload === "object" && payload !== null && "workId" in payload
      ? Number(payload.workId)
      : Number.NaN;
  const placement =
    typeof payload === "object" && payload !== null && "placement" in payload
      ? payload.placement
      : null;
  const sourcePage = normalizeAffiliateSource(
    typeof payload === "object" && payload !== null && "sourcePage" in payload
      ? typeof payload.sourcePage === "string"
        ? payload.sourcePage
        : null
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
    !placements.has(placement as AffiliatePlacement)
  ) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  let { error } = await supabaseAdmin.from("affiliate_clicks").insert({
    work_id: workId,
    placement,
    source_page: sourcePage,
    cta_variant: ctaVariant,
  });

  // Do not lose click tracking while the database migration is being applied.
  if (error && isMissingCtaVariant(error)) {
    const fallback = await supabaseAdmin.from("affiliate_clicks").insert({
      work_id: workId,
      placement,
      source_page: sourcePage,
    });
    error = fallback.error;
  }

  if (error) {
    console.error("[affiliate-click] failed to record click", {
      workId,
      placement,
      sourcePage,
      ctaVariant,
      code: error.code,
    });
    // Tracking must never turn a valid customer click into a UI error.
  }

  return new NextResponse(null, { status: 204 });
}
