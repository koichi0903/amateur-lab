import { NextResponse } from "next/server";
import { getFanzaAmateurPriceFromRawItem } from "@/lib/dmm/fanzaAmateurRawItem";
import { type ValidatedPushSubscriptionPayload } from "@/lib/pushSubscriptionPayload";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AmateurPayload = Extract<ValidatedPushSubscriptionPayload, { kind: "amateur" }>;
type WorkPayload = Extract<ValidatedPushSubscriptionPayload, { kind: "work" }>;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function amateurMakers(rawItem: unknown) {
  if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) return [];
  const iteminfo = (rawItem as Record<string, unknown>).iteminfo;
  if (typeof iteminfo !== "object" || iteminfo === null || Array.isArray(iteminfo)) return [];
  const makers = (iteminfo as Record<string, unknown>).maker;
  if (!Array.isArray(makers)) return [];
  return [...new Set(makers.flatMap((maker) => {
    if (typeof maker !== "object" || maker === null || Array.isArray(maker)) return [];
    const name = (maker as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() ? [name.trim().slice(0, 200)] : [];
  }))];
}

function splitNames(value: string | null | undefined) {
  return [...new Set((value ?? "").split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((name) => name.trim()).filter(Boolean))];
}

async function saveSubscriptionRecord(
  request: Request,
  payload: ValidatedPushSubscriptionPayload,
  logMessage: string,
) {
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
    endpoint: payload.endpoint,
    p256dh: payload.p256dh,
    auth: payload.auth,
    user_agent: request.headers.get("user-agent"),
    active: true,
  }, { onConflict: "endpoint" });
  if (error) {
    console.error(logMessage, error);
    return false;
  }
  return true;
}

export async function saveAmateurSubscription(payload: AmateurPayload, request: Request) {
  const { body, endpoint, contentId } = payload;
  const { data: work, error: workError } = await supabaseAdmin
    .from("fanza_amateur_works")
    .select("content_id,raw_item")
    .eq("content_id", contentId)
    .maybeSingle();
  if (workError || !work) return errorResponse("対象の素人作品が見つかりません", 404);

  const availableMakers = amateurMakers(work.raw_item);
  const currentPrice = getFanzaAmateurPriceFromRawItem(work.raw_item);
  if (!(await saveSubscriptionRecord(request, payload, "[push] amateur subscription save failed"))) {
    return errorResponse("通知先を保存できませんでした", 500);
  }

  const { error: priceAlertError } = body.priceAlert
    ? await supabaseAdmin.from("push_amateur_price_alerts").upsert(
        { endpoint, content_id: contentId, last_notified_price: currentPrice },
        { onConflict: "endpoint,content_id", ignoreDuplicates: true },
      )
    : await supabaseAdmin.from("push_amateur_price_alerts").delete().eq("endpoint", endpoint).eq("content_id", contentId);
  if (priceAlertError) return errorResponse("素人作品の値下げ通知を保存できませんでした", 500);

  if (availableMakers.length) {
    const { error: deleteError } = await supabaseAdmin
      .from("push_amateur_maker_alerts")
      .delete()
      .eq("endpoint", endpoint)
      .in("maker_name", availableMakers);
    if (deleteError) return errorResponse("メーカー新作通知を保存できませんでした", 500);

    const selectedMakers = [...new Set(body.makerAlerts ?? [])].filter((name) => availableMakers.includes(name));
    if (selectedMakers.length) {
      const { error: makerError } = await supabaseAdmin.from("push_amateur_maker_alerts").upsert(
        selectedMakers.map((makerName) => ({ endpoint, maker_name: makerName })),
        { onConflict: "endpoint,maker_name" },
      );
      if (makerError) return errorResponse("メーカー新作通知を保存できませんでした", 500);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function saveWorkSubscription(payload: WorkPayload, request: Request) {
  const { body, endpoint, workId } = payload;
  const { data: work, error: workError } = await supabaseAdmin
    .from("works")
    .select("id,price,sale_price,actress,maker")
    .eq("id", workId)
    .maybeSingle();
  if (workError || !work) return errorResponse("対象作品が見つかりません", 404);

  const currentPrice = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
  if (!(await saveSubscriptionRecord(request, payload, "[push] subscription save failed"))) {
    return errorResponse("通知先を保存できませんでした", 500);
  }

  const { error: priceAlertError } = body.priceAlert
    ? await supabaseAdmin.from("push_price_alerts").upsert(
        { endpoint, work_id: workId, last_notified_price: currentPrice },
        { onConflict: "endpoint,work_id", ignoreDuplicates: true },
      )
    : await supabaseAdmin.from("push_price_alerts").delete().eq("endpoint", endpoint).eq("work_id", workId);
  if (priceAlertError) return errorResponse("値下げ通知を保存できませんでした", 500);

  const entityAlerts = [
    { type: "actress", available: splitNames(work.actress), selected: body.actressAlerts ?? [] },
    { type: "maker", available: splitNames(work.maker), selected: body.makerAlerts ?? [] },
  ];
  for (const entity of entityAlerts) {
    if (!entity.available.length) continue;
    const { error: deleteError } = await supabaseAdmin.from("push_series_alerts")
      .delete().eq("endpoint", endpoint).eq("alert_type", entity.type).in("series_name", entity.available);
    if (deleteError) return errorResponse("新作通知を保存できませんでした", 500);

    const selected = [...new Set(entity.selected)].filter((name) => entity.available.includes(name));
    if (!selected.length) continue;
    const { error: entityError } = await supabaseAdmin.from("push_series_alerts").upsert(
      selected.map((name) => ({ endpoint, alert_type: entity.type, series_name: name })),
      { onConflict: "endpoint,alert_type,series_name" },
    );
    if (entityError) return errorResponse("新作通知を保存できませんでした", 500);
  }

  return NextResponse.json({ ok: true });
}
