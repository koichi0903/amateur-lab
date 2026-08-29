import { NextResponse } from "next/server";
import { normalizeAffiliateSource } from "@/lib/affiliateTracking";
import {
  isOperatorLandingPath,
  normalizeExternalAttribution,
} from "@/lib/externalAttribution";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function readNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const event = payload as Record<string, unknown>;
  const workId = Number(event.workId);
  const sourcePage = normalizeAffiliateSource(
    typeof event.sourcePage === "string" ? event.sourcePage : null,
  );
  const externalAttribution = normalizeExternalAttribution(
    "externalAttribution" in event ? event.externalAttribution : null,
  );

  if (!Number.isSafeInteger(workId) || workId <= 0) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  if (isOperatorLandingPath(externalAttribution?.landingPath)) {
    return new NextResponse(null, { status: 204 });
  }

  const xPostKey =
    typeof event.xPostKey === "string" && event.xPostKey.trim()
      ? event.xPostKey.trim().slice(0, 120)
      : null;

  const { error } = await supabaseAdmin.from("work_page_views").insert({
    work_id: workId,
    source_page: sourcePage,
    price: readNumber(event, "price"),
    discount_rate: readNumber(event, "discountRate"),
    discovery_score: readNumber(event, "discoveryScore"),
    ranking: readNumber(event, "ranking"),
    x_post_key: xPostKey,
    external_channel: externalAttribution?.channel,
    external_source: externalAttribution?.source,
    landing_path: externalAttribution?.landingPath,
  });

  if (error) {
    console.error("[work-page-view] failed to record page view", {
      workId,
      sourcePage,
      code: error.code,
    });
  }

  return new NextResponse(null, { status: 204 });
}
