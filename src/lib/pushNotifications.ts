import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPushNotification, type StoredPushSubscription } from "@/lib/push";

type PriceAlertRow = { endpoint: string; work_id: number; last_notified_price: number | null };
type WorkPriceRow = { id: number; product_id: string; title: string; price: number | null; sale_price: number | null };
type SubscriptionRow = { endpoint: string; p256dh: string; auth: string; active: boolean };
type SeriesWorkRow = { id: number; product_id: string; title: string; actress: string | null; maker: string | null; series: string | null };

type EntityAlertRow = { endpoint: string; alert_type: "actress" | "maker"; series_name: string };
type AmateurPriceAlertRow = { endpoint: string; content_id: string; last_notified_price: number | null };
type AmateurWorkRow = { content_id: string; title: string; prices: unknown; iteminfo?: unknown };
type AmateurMakerAlertRow = { endpoint: string; maker_name: string };

function amateurPrice(prices: unknown) {
  if (!prices || typeof prices !== "object" || Array.isArray(prices)) return null;
  const record = prices as { price?: unknown; list_price?: unknown };
  const parse = (value: unknown) => {
    const text = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
    const digits = text.match(/[0-9][0-9,]*/)?.[0]?.replaceAll(",", "");
    const parsed = digits ? Number(digits) : NaN;
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };
  return parse(record.price) ?? parse(record.list_price);
}

function amateurMakers(iteminfo: unknown) {
  if (!iteminfo || typeof iteminfo !== "object" || Array.isArray(iteminfo)) return [];
  const makers = (iteminfo as { maker?: unknown }).maker;
  if (!Array.isArray(makers)) return [];
  return [...new Set(makers.flatMap((maker) => {
    if (!maker || typeof maker !== "object" || Array.isArray(maker)) return [];
    const name = (maker as { name?: unknown }).name;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  }))];
}

function isExpiredPushEndpoint(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    && ([404, 410] as number[]).includes((error as { statusCode?: number }).statusCode ?? 0);
}

function splitEntityNames(value: string | null) {
  return [...new Set((value ?? "").split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((name) => name.trim()).filter(Boolean))];
}

export async function notifyPriceAlertsForProducts(productIds: string[]) {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return { sent: 0, skipped: 0 };

  const { data: works, error: worksError } = await supabaseAdmin.from("works").select("id,product_id,title,price,sale_price").in("product_id", ids);
  if (worksError) throw worksError;
  const workRows = (works ?? []) as WorkPriceRow[];
  const workById = new Map(workRows.map((work) => [work.id, work]));
  if (!workRows.length) return { sent: 0, skipped: 0 };

  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_price_alerts").select("endpoint,work_id,last_notified_price").in("work_id", workRows.map((work) => work.id));
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as PriceAlertRow[];
  if (!alertRows.length) return { sent: 0, skipped: 0 };

  const endpoints = [...new Set(alertRows.map((alert) => alert.endpoint))];
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth,active").in("endpoint", endpoints).eq("active", true);
  if (subscriptionsError) throw subscriptionsError;
  const subscriptionByEndpoint = new Map((subscriptions ?? []).map((subscription) => [subscription.endpoint, subscription as SubscriptionRow]));

  let sent = 0;
  let skipped = 0;
  for (const alert of alertRows) {
    const work = workById.get(alert.work_id);
    const subscription = subscriptionByEndpoint.get(alert.endpoint);
    const currentPrice = work && work.sale_price && work.sale_price > 0 ? work.sale_price : work?.price;
    if (!work || !subscription || !currentPrice || currentPrice <= 0) {
      skipped += 1;
      continue;
    }
    if (alert.last_notified_price == null) {
      await supabaseAdmin.from("push_price_alerts").update({ last_notified_price: currentPrice }).eq("endpoint", alert.endpoint).eq("work_id", alert.work_id);
      skipped += 1;
      continue;
    }
    if (currentPrice >= alert.last_notified_price) {
      if (currentPrice !== alert.last_notified_price) await supabaseAdmin.from("push_price_alerts").update({ last_notified_price: currentPrice }).eq("endpoint", alert.endpoint).eq("work_id", alert.work_id);
      skipped += 1;
      continue;
    }

    const pushSubscription: StoredPushSubscription = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } };
    try {
      await sendPushNotification(pushSubscription, { title: "発掘LAB：価格が下がりました", body: `${work.title} が ¥${currentPrice.toLocaleString("ja-JP")} になりました。`, url: `/works/${work.id}`, tag: `price-${work.id}` });
      sent += 1;
    } catch (error) {
      console.error("[push] price notification failed", { endpoint: alert.endpoint, workId: alert.work_id, error });
      if (typeof error === "object" && error !== null && "statusCode" in error && ([404, 410] as number[]).includes((error as { statusCode?: number }).statusCode ?? 0)) {
        await supabaseAdmin.from("push_subscriptions").update({ active: false, last_error_at: new Date().toISOString() }).eq("endpoint", alert.endpoint);
      }
      skipped += 1;
    }
    await supabaseAdmin.from("push_price_alerts").update({ last_notified_price: currentPrice }).eq("endpoint", alert.endpoint).eq("work_id", alert.work_id);
  }
  return { sent, skipped };
}

export async function notifyAmateurPriceAlertsForContentIds(contentIds: string[]) {
  const ids = [...new Set(contentIds)].filter(Boolean);
  if (!ids.length) return { sent: 0, skipped: 0 };
  const { data: works, error: worksError } = await supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,prices").in("content_id", ids);
  if (worksError) throw worksError;
  const workRows = (works ?? []) as AmateurWorkRow[];
  if (!workRows.length) return { sent: 0, skipped: 0 };
  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_amateur_price_alerts")
    .select("endpoint,content_id,last_notified_price").in("content_id", workRows.map((work) => work.content_id));
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as AmateurPriceAlertRow[];
  if (!alertRows.length) return { sent: 0, skipped: 0 };
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from("push_subscriptions")
    .select("endpoint,p256dh,auth,active").in("endpoint", [...new Set(alertRows.map((alert) => alert.endpoint))]).eq("active", true);
  if (subscriptionsError) throw subscriptionsError;
  const subscriptionByEndpoint = new Map((subscriptions ?? []).map((row) => [row.endpoint, row as SubscriptionRow]));
  const workByContentId = new Map(workRows.map((work) => [work.content_id, work]));
  let sent = 0;
  let skipped = 0;
  for (const alert of alertRows) {
    const work = workByContentId.get(alert.content_id);
    const subscription = subscriptionByEndpoint.get(alert.endpoint);
    const currentPrice = work ? amateurPrice(work.prices) : null;
    if (!work || !subscription || currentPrice === null) { skipped += 1; continue; }
    if (alert.last_notified_price == null || currentPrice >= alert.last_notified_price) {
      if (alert.last_notified_price !== currentPrice) {
        const { error } = await supabaseAdmin.from("push_amateur_price_alerts").update({ last_notified_price: currentPrice })
          .eq("endpoint", alert.endpoint).eq("content_id", alert.content_id);
        if (error) throw error;
      }
      skipped += 1;
      continue;
    }
    try {
      await sendPushNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, {
        title: "発掘LAB：価格が下がりました",
        body: `${work.title} が ¥${currentPrice.toLocaleString("ja-JP")} になりました。`,
        url: `/amateur/${encodeURIComponent(work.content_id)}`,
        tag: `amateur-price-${work.content_id}`,
      });
      const { error } = await supabaseAdmin.from("push_amateur_price_alerts").update({ last_notified_price: currentPrice })
        .eq("endpoint", alert.endpoint).eq("content_id", alert.content_id);
      if (error) throw error;
      sent += 1;
    } catch (error) {
      console.error("[push] amateur price notification failed", { contentId: alert.content_id, error });
      if (isExpiredPushEndpoint(error)) await supabaseAdmin.from("push_subscriptions")
        .update({ active: false, last_error_at: new Date().toISOString() }).eq("endpoint", alert.endpoint);
      skipped += 1;
    }
  }
  return { sent, skipped };
}

export async function notifyAmateurMakerAlertsForContentIds(contentIds: string[]) {
  const ids = [...new Set(contentIds)].filter(Boolean);
  if (!ids.length) return { sent: 0, skipped: 0 };
  const { data: works, error: worksError } = await supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,iteminfo").in("content_id", ids);
  if (worksError) throw worksError;
  const workRows = (works ?? []) as AmateurWorkRow[];
  const makerNames = [...new Set(workRows.flatMap((work) => amateurMakers(work.iteminfo)))];
  if (!makerNames.length) return { sent: 0, skipped: 0 };
  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_amateur_maker_alerts")
    .select("endpoint,maker_name").in("maker_name", makerNames);
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as AmateurMakerAlertRow[];
  if (!alertRows.length) return { sent: 0, skipped: 0 };
  const endpoints = [...new Set(alertRows.map((alert) => alert.endpoint))];
  const endpointBatches: string[][] = [];
  for (let index = 0; index < endpoints.length; index += 25) endpointBatches.push(endpoints.slice(index, index + 25));
  const delivered = new Set<string>();
  const subscriptionByEndpoint = new Map<string, SubscriptionRow>();
  for (const endpointBatch of endpointBatches) {
    const deliveries = await supabaseAdmin.from("push_amateur_maker_alert_deliveries")
      .select("endpoint,maker_name,content_id").in("endpoint", endpointBatch).in("content_id", workRows.map((work) => work.content_id));
    if (deliveries.error) throw deliveries.error;
    for (const row of deliveries.data ?? []) delivered.add(`${row.endpoint}\u0000${row.maker_name}\u0000${row.content_id}`);
    const subscriptions = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth,active")
      .in("endpoint", endpointBatch).eq("active", true);
    if (subscriptions.error) throw subscriptions.error;
    for (const row of subscriptions.data ?? []) subscriptionByEndpoint.set(row.endpoint, row as SubscriptionRow);
  }
  let sent = 0;
  let skipped = 0;
  for (const alert of alertRows) {
    const subscription = subscriptionByEndpoint.get(alert.endpoint);
    if (!subscription) { skipped += 1; continue; }
    for (const work of workRows) {
      if (!amateurMakers(work.iteminfo).includes(alert.maker_name)) continue;
      const deliveryKey = `${alert.endpoint}\u0000${alert.maker_name}\u0000${work.content_id}`;
      if (delivered.has(deliveryKey)) continue;
      try {
        await sendPushNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, {
          title: "発掘LAB：メーカーの新作です",
          body: `${alert.maker_name}の新しい作品「${work.title}」が登録されました。`,
          url: `/amateur/${encodeURIComponent(work.content_id)}`,
          tag: `amateur-maker-${alert.maker_name}`,
        });
        const { error } = await supabaseAdmin.from("push_amateur_maker_alert_deliveries")
          .insert({ endpoint: alert.endpoint, maker_name: alert.maker_name, content_id: work.content_id });
        if (error) throw error;
        delivered.add(deliveryKey);
        sent += 1;
      } catch (error) {
        console.error("[push] amateur maker notification failed", { contentId: work.content_id, makerName: alert.maker_name, error });
        if (isExpiredPushEndpoint(error)) await supabaseAdmin.from("push_subscriptions")
          .update({ active: false, last_error_at: new Date().toISOString() }).eq("endpoint", alert.endpoint);
        skipped += 1;
      }
    }
  }
  return { sent, skipped };
}

export async function notifySeriesAlertsForProducts(productIds: string[]) {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return { sent: 0, skipped: 0 };
  const { data: works, error: worksError } = await supabaseAdmin.from("works").select("id,product_id,title,actress,maker,series").in("product_id", ids);
  if (worksError) throw worksError;
  const workRows = (works ?? []) as SeriesWorkRow[];
  const entityNames = [...new Set(workRows.flatMap((work) => [
    ...splitEntityNames(work.actress),
    ...splitEntityNames(work.maker),
  ]))];
  if (!entityNames.length) return { sent: 0, skipped: 0 };

  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_series_alerts").select("endpoint,alert_type,series_name").in("series_name", entityNames).in("alert_type", ["actress", "maker"]);
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as EntityAlertRow[];
  if (!alertRows.length) return { sent: 0, skipped: 0 };
  const { data: deliveries, error: deliveriesError } = await supabaseAdmin.from("push_series_alert_deliveries").select("endpoint,alert_type,series_name,work_id").in("endpoint", [...new Set(alertRows.map((alert) => alert.endpoint))]).in("work_id", workRows.map((work) => work.id));
  if (deliveriesError) throw deliveriesError;
  const delivered = new Set((deliveries ?? []).map((row) => `${row.endpoint}\u0000${row.alert_type}\u0000${row.series_name}\u0000${row.work_id}`));
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth,active").in("endpoint", [...new Set(alertRows.map((alert) => alert.endpoint))]).eq("active", true);
  if (subscriptionsError) throw subscriptionsError;
  const subscriptionByEndpoint = new Map((subscriptions ?? []).map((subscription) => [subscription.endpoint, subscription as SubscriptionRow]));

  let sent = 0;
  let skipped = 0;
  for (const alert of alertRows) {
    const subscription = subscriptionByEndpoint.get(alert.endpoint);
    if (!subscription) { skipped += 1; continue; }
    for (const work of workRows) {
      const names = alert.alert_type === "actress" ? splitEntityNames(work.actress) : splitEntityNames(work.maker);
      const matches = names.includes(alert.series_name);
      const deliveryKey = `${alert.endpoint}\u0000${alert.alert_type}\u0000${alert.series_name}\u0000${work.id}`;
      if (!matches || delivered.has(deliveryKey)) continue;
      try {
        const label = alert.alert_type === "actress" ? "女優" : "メーカー";
        await sendPushNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, { title: `発掘LAB：${label}の新作です`, body: `${alert.series_name}の新しい作品「${work.title}」が登録されました。`, url: `/works/${work.id}`, tag: `${alert.alert_type}-${alert.series_name}` });
        await supabaseAdmin.from("push_series_alert_deliveries").insert({ endpoint: alert.endpoint, alert_type: alert.alert_type, series_name: alert.series_name, work_id: work.id });
        delivered.add(deliveryKey);
        sent += 1;
      } catch (error) {
        console.error("[push] series notification failed", { endpoint: alert.endpoint, workId: work.id, error });
        skipped += 1;
      }
    }
  }
  return { sent, skipped };
}
