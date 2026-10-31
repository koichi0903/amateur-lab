import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseWorkPageViewEvent, type WorkPageViewInsert } from "@/lib/workPageViewEvent";

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

  const parsedEvent = parseWorkPageViewEvent(payload);
  if (parsedEvent.kind === "invalid") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  if (parsedEvent.kind === "ignored") {
    return new NextResponse(null, { status: 204 });
  }
  const error = await insertWorkPageViewWithSchemaFallback(parsedEvent.eventRow);

  if (error) {
    console.error("[work-page-view] failed to record page view", {
      workId: parsedEvent.eventRow.work_id,
      sourcePage: parsedEvent.eventRow.source_page,
      code: error.code,
    });
  }

  return new NextResponse(null, { status: 204 });
}
