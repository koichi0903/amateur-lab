import { NextResponse } from "next/server";
import {
  type AffiliateSource,
  normalizeAffiliateSource,
} from "@/lib/affiliateTracking";
import {
  isOperatorLandingPath,
  normalizeExternalAttribution,
  type ExternalAttribution,
} from "@/lib/externalAttribution";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function readNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

type WorkPageViewInsert = {
  work_id: number;
  source_page: AffiliateSource;
  price: number | null;
  discount_rate: number | null;
  discovery_score: number | null;
  ranking: number | null;
  x_post_key: string | null;
  external_channel: ExternalAttribution["channel"] | undefined;
  external_source: string | undefined;
  landing_path: string | undefined;
};

async function insertWorkPageViewWithSchemaFallback(eventRow: WorkPageViewInsert) {
  let { error } = await supabaseAdmin.from("work_page_views").insert(eventRow);

  // Keep the same ordered fallbacks while older schema caches lack newer columns.
  if (error?.code === "PGRST204") {
    const fallback = await supabaseAdmin.from("work_page_views").insert({
      work_id: eventRow.work_id,
      source_page: eventRow.source_page,
      price: eventRow.price,
      discount_rate: eventRow.discount_rate,
      discovery_score: eventRow.discovery_score,
      ranking: eventRow.ranking,
      x_post_key: eventRow.x_post_key,
    });
    error = fallback.error;
  }

  if (error?.code === "PGRST204") {
    const fallback = await supabaseAdmin.from("work_page_views").insert({
      work_id: eventRow.work_id,
      source_page: eventRow.source_page,
      price: eventRow.price,
      discount_rate: eventRow.discount_rate,
      discovery_score: eventRow.discovery_score,
      ranking: eventRow.ranking,
    });
    error = fallback.error;
  }

  return error;
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

  const eventRow = {
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
  };

  const error = await insertWorkPageViewWithSchemaFallback(eventRow);

  if (error) {
    console.error("[work-page-view] failed to record page view", {
      workId,
      sourcePage,
      code: error.code,
    });
  }

  return new NextResponse(null, { status: 204 });
}
