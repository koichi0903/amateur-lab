import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SubscribeBody = {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  workId?: number;
  priceAlert?: boolean;
  actressAlerts?: string[];
  makerAlerts?: string[];
};

const PUSH_SAVE_TIMEOUT_MS = 15_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push通知はまだ設定されていません" }, { status: 503 });
  return NextResponse.json({ publicKey });
}

async function saveSubscription(request: Request) {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return badRequest("通知設定の形式が正しくありません");
  }

  const endpoint = body.subscription?.endpoint?.trim() ?? "";
  const p256dh = body.subscription?.keys?.p256dh?.trim();
  const auth = body.subscription?.keys?.auth?.trim();
  const workId = Number(body.workId);
  const endpointIsValid = endpoint ? (() => {
    try { return new URL(endpoint).protocol === "https:"; } catch { return false; }
  })() : false;
  if (!endpointIsValid || endpoint.length > 2048 || !p256dh || p256dh.length > 512 || !auth || auth.length > 512 || !Number.isSafeInteger(workId) || workId <= 0) {
    return badRequest("通知購読情報が不足しています");
  }

  const { data: work, error: workError } = await supabaseAdmin.from("works").select("id,price,sale_price,actress,maker").eq("id", workId).maybeSingle();
  if (workError || !work) return NextResponse.json({ error: "対象作品が見つかりません" }, { status: 404 });
  const currentPrice = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;

  const { error: subscriptionError } = await supabaseAdmin.from("push_subscriptions").upsert({
    endpoint,
    p256dh,
    auth,
    user_agent: request.headers.get("user-agent"),
    active: true,
  }, { onConflict: "endpoint" });
  if (subscriptionError) {
    console.error("[push] subscription save failed", subscriptionError);
    return NextResponse.json({ error: "通知先を保存できませんでした" }, { status: 500 });
  }

  const { error: priceAlertError } = body.priceAlert
    ? await supabaseAdmin.from("push_price_alerts").upsert({ endpoint, work_id: workId, last_notified_price: currentPrice }, { onConflict: "endpoint,work_id", ignoreDuplicates: true })
    : await supabaseAdmin.from("push_price_alerts").delete().eq("endpoint", endpoint).eq("work_id", workId);
  if (priceAlertError) return NextResponse.json({ error: "値下げ通知を保存できませんでした" }, { status: 500 });

  const splitNames = (value: string | null | undefined) => [...new Set((value ?? "").split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((name) => name.trim()).filter(Boolean))];
  const entityAlerts = [
    { type: "actress", available: splitNames(work.actress), selected: body.actressAlerts ?? [] },
    { type: "maker", available: splitNames(work.maker), selected: body.makerAlerts ?? [] },
  ];
  for (const entity of entityAlerts) {
    if (!entity.available.length) continue;
    const { error: deleteError } = await supabaseAdmin.from("push_series_alerts").delete().eq("endpoint", endpoint).eq("alert_type", entity.type).in("series_name", entity.available);
    if (deleteError) return NextResponse.json({ error: "新作通知を保存できませんでした" }, { status: 500 });
    const selected = [...new Set(entity.selected)].filter((name) => entity.available.includes(name));
    if (!selected.length) continue;
    const { error: entityError } = await supabaseAdmin.from("push_series_alerts").upsert(selected.map((name) => ({ endpoint, alert_type: entity.type, series_name: name })), { onConflict: "endpoint,alert_type,series_name" });
    if (entityError) return NextResponse.json({ error: "新作通知を保存できませんでした" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    return await Promise.race([
      saveSubscription(request),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("通知設定の保存がタイムアウトしました")), PUSH_SAVE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error("[push] subscribe request failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "通知設定を保存できませんでした" },
      { status: 504 },
    );
  }
}
