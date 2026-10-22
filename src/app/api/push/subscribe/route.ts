import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SubscribeBody = {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  mediaType?: "regular" | "amateur";
  workId?: number;
  contentId?: string;
  priceAlert?: boolean;
  actressAlerts?: string[];
  makerAlerts?: string[];
};

const PUSH_SAVE_TIMEOUT_MS = 15_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function priceNumber(value: unknown): number | null {
  const digits = typeof value === "number" ? String(value) : typeof value === "string" ? value.match(/[0-9][0-9,]*/)?.[0]?.replaceAll(",", "") : null;
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function amateurMakerNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const name = (entry as { name?: unknown }).name;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  }))];
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
  const mediaType = body.mediaType ?? "regular";
  if (mediaType !== "regular" && mediaType !== "amateur") return badRequest("通知対象の種類が不正です。");
  const endpointIsValid = endpoint ? (() => {
    try { return new URL(endpoint).protocol === "https:"; } catch { return false; }
  })() : false;
  if (!endpointIsValid || endpoint.length > 2048 || !p256dh || p256dh.length > 512 || !auth || auth.length > 512) {
    return badRequest("通知購読情報が不足しています");
  }

  let workId = 0;
  let contentId = "";
  let currentPrice: number | null = null;
  let availableMakers: string[] = [];
  let actressNames: string[] = [];
  let regularMakerNames: string[] = [];

  if (mediaType === "amateur") {
    contentId = body.contentId?.trim() ?? "";
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(contentId)) return badRequest("通知対象の作品IDが不正です。");
    const { data: work, error: workError } = await supabaseAdmin.from("fanza_amateur_works")
      .select("content_id,prices,iteminfo").eq("content_id", contentId).maybeSingle();
    if (workError) {
      console.error("[push] amateur work lookup failed", workError);
      return NextResponse.json({ error: "素人作品の通知設定を確認できませんでした" }, { status: 500 });
    }
    if (!work) return NextResponse.json({ error: "対象の素人作品が見つかりません" }, { status: 404 });
    const prices = work.prices && typeof work.prices === "object" && !Array.isArray(work.prices)
      ? work.prices as { price?: unknown; list_price?: unknown }
      : {};
    currentPrice = priceNumber(prices.price) ?? priceNumber(prices.list_price);
    const iteminfo = work.iteminfo && typeof work.iteminfo === "object" && !Array.isArray(work.iteminfo)
      ? work.iteminfo as { maker?: unknown }
      : {};
    availableMakers = amateurMakerNames(iteminfo.maker);
  } else {
    workId = Number(body.workId);
    if (!Number.isSafeInteger(workId) || workId <= 0) return badRequest("通知購読情報が不足しています");
    const { data: work, error: workError } = await supabaseAdmin.from("works")
      .select("id,price,sale_price,actress,maker").eq("id", workId).maybeSingle();
    if (workError) {
      console.error("[push] regular work lookup failed", workError);
      return NextResponse.json({ error: "作品の通知設定を確認できませんでした" }, { status: 500 });
    }
    if (!work) return NextResponse.json({ error: "対象作品が見つかりません" }, { status: 404 });
    currentPrice = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
    const splitNames = (value: string | null | undefined) => [...new Set((value ?? "").split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((name) => name.trim()).filter(Boolean))];
    actressNames = splitNames(work.actress);
    regularMakerNames = splitNames(work.maker);
  }

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

  const { error: priceAlertError } = mediaType === "amateur"
    ? body.priceAlert
      ? await supabaseAdmin.from("push_amateur_price_alerts").upsert({ endpoint, content_id: contentId, last_notified_price: currentPrice }, { onConflict: "endpoint,content_id", ignoreDuplicates: true })
      : await supabaseAdmin.from("push_amateur_price_alerts").delete().eq("endpoint", endpoint).eq("content_id", contentId)
    : body.priceAlert
      ? await supabaseAdmin.from("push_price_alerts").upsert({ endpoint, work_id: workId, last_notified_price: currentPrice }, { onConflict: "endpoint,work_id", ignoreDuplicates: true })
      : await supabaseAdmin.from("push_price_alerts").delete().eq("endpoint", endpoint).eq("work_id", workId);
  if (priceAlertError) return NextResponse.json({ error: "値下げ通知を保存できませんでした" }, { status: 500 });

  if (mediaType === "amateur") {
    if (availableMakers.length > 0) {
      const { error: deleteError } = await supabaseAdmin.from("push_amateur_maker_alerts").delete().eq("endpoint", endpoint).in("maker_name", availableMakers);
      if (deleteError) return NextResponse.json({ error: "メーカー新作通知を保存できませんでした" }, { status: 500 });
    }
    const selectedMakers = [...new Set((body.makerAlerts ?? []).filter((name): name is string => typeof name === "string").map((name) => name.trim()).filter(Boolean))]
      .filter((name) => availableMakers.includes(name));
    if (selectedMakers.length > 0) {
      const { error: makerError } = await supabaseAdmin.from("push_amateur_maker_alerts").upsert(
        selectedMakers.map((makerName) => ({ endpoint, maker_name: makerName })), { onConflict: "endpoint,maker_name" });
      if (makerError) return NextResponse.json({ error: "メーカー新作通知を保存できませんでした" }, { status: 500 });
    }
  } else {
    const entityAlerts = [
      { type: "actress", available: actressNames, selected: body.actressAlerts ?? [] },
      { type: "maker", available: regularMakerNames, selected: body.makerAlerts ?? [] },
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
