import { NextResponse } from "next/server";
import { type ValidatedPushSubscriptionPayload } from "@/lib/pushSubscriptionPayload";
import { buildWorkEntityAlertPlans, type WorkEntityAlertPlan } from "@/lib/pushWorkEntityAlertPlan";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AmateurPayload = Extract<ValidatedPushSubscriptionPayload, { kind: "amateur" }>;
type WorkPayload = Extract<ValidatedPushSubscriptionPayload, { kind: "work" }>;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function amateurPriceNumber(value: unknown): number | null {
  const digits = typeof value === "number"
    ? String(value)
    : typeof value === "string"
      ? value.match(/[0-9][0-9,]*/)?.[0]?.replaceAll(",", "")
      : null;
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function amateurMakers(iteminfoValue: unknown) {
  if (typeof iteminfoValue !== "object" || iteminfoValue === null || Array.isArray(iteminfoValue)) return [];
  const makers = (iteminfoValue as Record<string, unknown>).maker;
  if (!Array.isArray(makers)) return [];
  return [...new Set(makers.flatMap((maker) => {
    if (typeof maker !== "object" || maker === null || Array.isArray(maker)) return [];
    const name = (maker as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  }))];
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

async function saveWorkEntityAlertPlan(endpoint: string, entity: WorkEntityAlertPlan) {
  if (!entity.available.length) return true;
  const { error: deleteError } = await supabaseAdmin.from("push_series_alerts")
    .delete().eq("endpoint", endpoint).eq("alert_type", entity.type).in("series_name", entity.available);
  if (deleteError) return false;
  if (!entity.selected.length) return true;

  const { error } = await supabaseAdmin.from("push_series_alerts").upsert(
    entity.selected.map((name) => ({ endpoint, alert_type: entity.type, series_name: name })),
    { onConflict: "endpoint,alert_type,series_name" },
  );
  return !error;
}

async function saveWorkEntityAlerts(endpoint: string, entities: WorkEntityAlertPlan[]) {
  for (const entity of entities) {
    if (!(await saveWorkEntityAlertPlan(endpoint, entity))) return false;
  }
  return true;
}

export async function saveAmateurSubscription(payload: AmateurPayload, request: Request) {
  const { body, endpoint, contentId } = payload;
  const { data: work, error: workError } = await supabaseAdmin
    .from("fanza_amateur_works")
    .select("content_id,prices,iteminfo")
    .eq("content_id", contentId)
    .maybeSingle();
  if (workError) {
    console.error("[push] amateur work lookup failed", workError);
    return errorResponse("素人作品の通知設定を確認できませんでした", 500);
  }
  if (!work) return errorResponse("対象の素人作品が見つかりません", 404);

  const availableMakers = amateurMakers(work.iteminfo);
  const prices = work.prices && typeof work.prices === "object" && !Array.isArray(work.prices)
    ? work.prices as { price?: unknown; list_price?: unknown }
    : {};
  const currentPrice = amateurPriceNumber(prices.price) ?? amateurPriceNumber(prices.list_price);
  if (!(await saveSubscriptionRecord(request, payload, "[push] amateur subscription save failed"))) {
    return errorResponse("通知先を保存できませんでした", 500);
  }

  const { error: priceAlertError } = body.priceAlert
    ? await supabaseAdmin.from("push_amateur_price_alerts").upsert(
        { endpoint, content_id: contentId, last_notified_price: currentPrice },
        { onConflict: "endpoint,content_id", ignoreDuplicates: true },
      )
    : await supabaseAdmin.from("push_amateur_price_alerts").delete().eq("endpoint", endpoint).eq("content_id", contentId);
  if (priceAlertError) return errorResponse("値下げ通知を保存できませんでした", 500);

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
  if (workError) {
    console.error("[push] regular work lookup failed", workError);
    return errorResponse("作品の通知設定を確認できませんでした", 500);
  }
  if (!work) return errorResponse("対象作品が見つかりません", 404);

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

  const entities = buildWorkEntityAlertPlans(work, body);
  if (!(await saveWorkEntityAlerts(endpoint, entities))) return errorResponse("新作通知を保存できませんでした", 500);

  return NextResponse.json({ ok: true });
}
