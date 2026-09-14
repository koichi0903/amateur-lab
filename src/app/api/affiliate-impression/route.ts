import { NextResponse } from "next/server";
import type { AffiliatePlacement } from "@/app/components/AffiliateLink";
import { normalizeAffiliateSource } from "@/lib/affiliateTracking";
import { normalizeCtaVariant } from "@/lib/ctaExperiment";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const experimentPlacements = new Set<AffiliatePlacement>([
  "detail-sidebar",
  "mobile-sticky",
]);

function isMissingXPostKey(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || error.message?.includes("x_post_key");
}

function optionalString(payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 120)
    : null;
}

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
  const xPostKey = optionalString(payload, "xPostKey");

  if (
    !Number.isSafeInteger(workId) ||
    workId <= 0 ||
    typeof placement !== "string" ||
    !experimentPlacements.has(placement as AffiliatePlacement)
  ) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

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
