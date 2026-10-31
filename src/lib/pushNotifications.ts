import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFanzaAmateurPriceFromRawItem } from "@/lib/dmm/fanzaAmateurRawItem";
import { sendPushNotification, type StoredPushSubscription } from "@/lib/push";
import { decidePriceAlert, isGonePushEndpointError } from "@/lib/pushPriceAlertDecision";
import {
  amateurMakerAlertDeliveryKey,
  amateurMakerAlertNames,
  matchesAmateurMakerAlert,
  type AmateurMakerAlertRule,
} from "@/lib/amateurMakerAlertRules";
import {
  getSeriesAlertEntityNames,
  matchesSeriesAlertWork,
  seriesAlertDeliveryKey,
  type SeriesAlertRule,
  type SeriesAlertWork,
} from "@/lib/pushSeriesAlertRules";

type PriceAlertRow = { endpoint: string; work_id: number; last_notified_price: number | null };
type WorkPriceRow = { id: number; product_id: string; title: string; price: number | null; sale_price: number | null };
type SubscriptionRow = { endpoint: string; p256dh: string; auth: string; active: boolean };

type AmateurPriceAlertRow = { endpoint: string; content_id: string; last_notified_price: number | null };
type AmateurWorkRow = { content_id: string; title: string; raw_item: unknown };

async function sendPriceDropAlert(alert: PriceAlertRow, work: WorkPriceRow, subscription: SubscriptionRow, currentPrice: number) {
  const pushSubscription: StoredPushSubscription = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } };
  try {
    await sendPushNotification(pushSubscription, { title: "発掘LAB：価格が下がりました", body: `${work.title} が ¥${currentPrice.toLocaleString("ja-JP")} になりました。`, url: `/works/${work.id}`, tag: `price-${work.id}` });
    return true;
  } catch (error) {
    console.error("[push] price notification failed", { endpoint: alert.endpoint, workId: alert.work_id, error });
    if (isGonePushEndpointError(error)) {
      await supabaseAdmin.from("push_subscriptions").update({ active: false, last_error_at: new Date().toISOString() }).eq("endpoint", alert.endpoint);
    }
    return false;
  }
}

type PriceAlertBatch = {
  alertRows: PriceAlertRow[];
  workById: Map<number, WorkPriceRow>;
  subscriptionByEndpoint: Map<string, SubscriptionRow>;
};

async function loadPriceAlertBatch(productIds: string[]): Promise<PriceAlertBatch | null> {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return null;

  const { data: works, error: worksError } = await supabaseAdmin.from("works").select("id,product_id,title,price,sale_price").in("product_id", ids);
  if (worksError) throw worksError;
  const workRows = (works ?? []) as WorkPriceRow[];
  const workById = new Map(workRows.map((work) => [work.id, work]));
  if (!workRows.length) return null;

  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_price_alerts").select("endpoint,work_id,last_notified_price").in("work_id", workRows.map((work) => work.id));
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as PriceAlertRow[];
  if (!alertRows.length) return null;

  const endpoints = [...new Set(alertRows.map((alert) => alert.endpoint))];
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth,active").in("endpoint", endpoints).eq("active", true);
  if (subscriptionsError) throw subscriptionsError;
  const subscriptionByEndpoint = new Map((subscriptions ?? []).map((subscription) => [subscription.endpoint, subscription as SubscriptionRow]));
  return { alertRows, workById, subscriptionByEndpoint };
}

async function processPriceAlert(alert: PriceAlertRow, batch: PriceAlertBatch): Promise<"sent" | "skipped"> {
  const work = batch.workById.get(alert.work_id);
  const subscription = batch.subscriptionByEndpoint.get(alert.endpoint);
  const currentPrice = work && work.sale_price && work.sale_price > 0 ? work.sale_price : work?.price;
  if (!work || !subscription || !currentPrice || currentPrice <= 0) return "skipped";

  const decision = decidePriceAlert(currentPrice, alert.last_notified_price);
  if (decision !== "notify") {
    if (decision !== "unchanged") await supabaseAdmin.from("push_price_alerts").update({ last_notified_price: currentPrice }).eq("endpoint", alert.endpoint).eq("work_id", alert.work_id);
    return "skipped";
  }

  const sent = await sendPriceDropAlert(alert, work, subscription, currentPrice);
  await supabaseAdmin.from("push_price_alerts").update({ last_notified_price: currentPrice }).eq("endpoint", alert.endpoint).eq("work_id", alert.work_id);
  return sent ? "sent" : "skipped";
}

export async function notifyPriceAlertsForProducts(productIds: string[]) {
  const batch = await loadPriceAlertBatch(productIds);
  if (!batch) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;
  for (const alert of batch.alertRows) {
    if (await processPriceAlert(alert, batch) === "sent") sent += 1;
    else skipped += 1;
  }
  return { sent, skipped };
}

type SeriesAlertBatch = {
  workRows: SeriesAlertWork[];
  alertRows: SeriesAlertRule[];
  delivered: Set<string>;
  subscriptionByEndpoint: Map<string, SubscriptionRow>;
};

async function loadSeriesAlertBatch(productIds: string[]): Promise<SeriesAlertBatch | null> {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return null;
  const { data: works, error: worksError } = await supabaseAdmin.from("works").select("id,product_id,title,actress,maker,series").in("product_id", ids);
  if (worksError) throw worksError;
  const workRows = (works ?? []) as SeriesAlertWork[];
  const entityNames = getSeriesAlertEntityNames(workRows);
  if (!entityNames.length) return null;

  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_series_alerts").select("endpoint,alert_type,series_name").in("series_name", entityNames).in("alert_type", ["actress", "maker"]);
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as SeriesAlertRule[];
  if (!alertRows.length) return null;
  const { data: deliveries, error: deliveriesError } = await supabaseAdmin.from("push_series_alert_deliveries").select("endpoint,alert_type,series_name,work_id").in("endpoint", [...new Set(alertRows.map((alert) => alert.endpoint))]).in("work_id", workRows.map((work) => work.id));
  if (deliveriesError) throw deliveriesError;
  const delivered = new Set((deliveries ?? []).map((row) => seriesAlertDeliveryKey(row.endpoint, row.alert_type, row.series_name, row.work_id)));
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth,active").in("endpoint", [...new Set(alertRows.map((alert) => alert.endpoint))]).eq("active", true);
  if (subscriptionsError) throw subscriptionsError;
  const subscriptionByEndpoint = new Map((subscriptions ?? []).map((subscription) => [subscription.endpoint, subscription as SubscriptionRow]));
  return { workRows, alertRows, delivered, subscriptionByEndpoint };
}

async function sendSeriesAlertWork(
  alert: SeriesAlertRule,
  work: SeriesAlertWork,
  subscription: SubscriptionRow,
  delivered: Set<string>,
) {
  const deliveryKey = seriesAlertDeliveryKey(alert.endpoint, alert.alert_type, alert.series_name, work.id);
  if (!matchesSeriesAlertWork(alert, work) || delivered.has(deliveryKey)) return null;

  try {
    const label = alert.alert_type === "actress" ? "女優" : "メーカー";
    await sendPushNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, { title: `発掘LAB：${label}の新作です`, body: `${alert.series_name}の新しい作品「${work.title}」が登録されました。`, url: `/works/${work.id}`, tag: `${alert.alert_type}-${alert.series_name}` });
    await supabaseAdmin.from("push_series_alert_deliveries").insert({ endpoint: alert.endpoint, alert_type: alert.alert_type, series_name: alert.series_name, work_id: work.id });
    delivered.add(deliveryKey);
    return "sent";
  } catch (error) {
    console.error("[push] series notification failed", { endpoint: alert.endpoint, workId: work.id, error });
    return "skipped";
  }
}

async function sendSeriesAlertToSubscription(
  alert: SeriesAlertRule,
  subscription: SubscriptionRow,
  workRows: SeriesAlertWork[],
  delivered: Set<string>,
) {
  let sent = 0;
  let skipped = 0;
  for (const work of workRows) {
    const result = await sendSeriesAlertWork(alert, work, subscription, delivered);
    if (result === "sent") sent += 1;
    if (result === "skipped") skipped += 1;
  }
  return { sent, skipped };
}

export async function notifySeriesAlertsForProducts(productIds: string[]) {
  const batch = await loadSeriesAlertBatch(productIds);
  if (!batch) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;
  for (const alert of batch.alertRows) {
    const subscription = batch.subscriptionByEndpoint.get(alert.endpoint);
    if (!subscription) {
      skipped += 1;
      continue;
    }
    const result = await sendSeriesAlertToSubscription(alert, subscription, batch.workRows, batch.delivered);
    sent += result.sent;
    skipped += result.skipped;
  }
  return { sent, skipped };
}

type AmateurPriceAlertBatch = {
  workById: Map<string, AmateurWorkRow>;
  alertRows: AmateurPriceAlertRow[];
  subscriptionByEndpoint: Map<string, SubscriptionRow>;
};

async function loadAmateurPriceAlertBatch(contentIds: string[]): Promise<AmateurPriceAlertBatch | null> {
  const ids = [...new Set(contentIds)].filter(Boolean);
  if (!ids.length) return null;
  const { data: works, error: worksError } = await supabaseAdmin.from("fanza_amateur_works").select("content_id,title,raw_item").in("content_id", ids);
  if (worksError) throw worksError;
  const workById = new Map(((works ?? []) as AmateurWorkRow[]).map((work) => [work.content_id, work]));
  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_amateur_price_alerts").select("endpoint,content_id,last_notified_price").in("content_id", ids);
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as AmateurPriceAlertRow[];
  if (!alertRows.length) return null;
  const endpoints = [...new Set(alertRows.map((alert) => alert.endpoint))];
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth,active").in("endpoint", endpoints).eq("active", true);
  if (subscriptionsError) throw subscriptionsError;
  const subscriptionByEndpoint = new Map((subscriptions ?? []).map((row) => [row.endpoint, row as SubscriptionRow]));
  return { workById, alertRows, subscriptionByEndpoint };
}

async function sendAmateurPriceAlert(alert: AmateurPriceAlertRow, batch: AmateurPriceAlertBatch): Promise<"sent" | "skipped"> {
  const work = batch.workById.get(alert.content_id);
  const subscription = batch.subscriptionByEndpoint.get(alert.endpoint);
  const currentPrice = work ? getFanzaAmateurPriceFromRawItem(work.raw_item) : null;
  if (!work || !subscription || currentPrice == null) return "skipped";

  const decision = decidePriceAlert(currentPrice, alert.last_notified_price);
  if (decision !== "notify") {
    if (decision !== "unchanged") await supabaseAdmin.from("push_amateur_price_alerts").update({ last_notified_price: currentPrice }).eq("endpoint", alert.endpoint).eq("content_id", alert.content_id);
    return "skipped";
  }

  let result: "sent" | "skipped" = "sent";
  const pushSubscription: StoredPushSubscription = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } };
  try {
    await sendPushNotification(pushSubscription, { title: "発掘LAB：価格が下がりました", body: `${work.title} が ¥${currentPrice.toLocaleString("ja-JP")} になりました。`, url: `/amateur/${encodeURIComponent(work.content_id)}`, tag: `amateur-price-${work.content_id}` });
  } catch (error) {
    result = "skipped";
    console.error("[push] amateur price notification failed", { endpoint: alert.endpoint, contentId: alert.content_id, error });
    if (isGonePushEndpointError(error)) {
      await supabaseAdmin.from("push_subscriptions").update({ active: false, last_error_at: new Date().toISOString() }).eq("endpoint", alert.endpoint);
    }
  }
  await supabaseAdmin.from("push_amateur_price_alerts").update({ last_notified_price: currentPrice }).eq("endpoint", alert.endpoint).eq("content_id", alert.content_id);
  return result;
}

export async function notifyAmateurPriceAlertsForContentIds(contentIds: string[]) {
  const batch = await loadAmateurPriceAlertBatch(contentIds);
  if (!batch) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;
  for (const alert of batch.alertRows) {
    if (await sendAmateurPriceAlert(alert, batch) === "sent") sent += 1;
    else skipped += 1;
  }
  return { sent, skipped };
}

type AmateurMakerAlertBatch = {
  workRows: AmateurWorkRow[];
  alertRows: AmateurMakerAlertRule[];
  subscriptionByEndpoint: Map<string, SubscriptionRow>;
  delivered: Set<string>;
};

async function loadAmateurMakerAlertBatch(contentIds: string[]): Promise<AmateurMakerAlertBatch | null> {
  const ids = [...new Set(contentIds)].filter(Boolean);
  if (!ids.length) return null;
  const { data: works, error: worksError } = await supabaseAdmin.from("fanza_amateur_works").select("content_id,title,raw_item").in("content_id", ids);
  if (worksError) throw worksError;
  const workRows = (works ?? []) as AmateurWorkRow[];
  const makerNames = amateurMakerAlertNames(workRows);
  if (!makerNames.length) return null;
  const { data: alerts, error: alertsError } = await supabaseAdmin.from("push_amateur_maker_alerts").select("endpoint,maker_name").in("maker_name", makerNames);
  if (alertsError) throw alertsError;
  const alertRows = (alerts ?? []) as AmateurMakerAlertRule[];
  if (!alertRows.length) return null;
  const endpoints = [...new Set(alertRows.map((alert) => alert.endpoint))];
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth,active").in("endpoint", endpoints).eq("active", true);
  if (subscriptionsError) throw subscriptionsError;
  const subscriptionByEndpoint = new Map((subscriptions ?? []).map((row) => [row.endpoint, row as SubscriptionRow]));
  const { data: deliveries, error: deliveriesError } = await supabaseAdmin.from("push_amateur_maker_alert_deliveries").select("endpoint,maker_name,content_id").in("endpoint", endpoints).in("content_id", ids);
  if (deliveriesError) throw deliveriesError;
  const delivered = new Set((deliveries ?? []).map((row) => amateurMakerAlertDeliveryKey(row.endpoint, row.maker_name, row.content_id)));
  return { workRows, alertRows, subscriptionByEndpoint, delivered };
}

async function sendAmateurMakerAlertWork(
  alert: AmateurMakerAlertRule,
  work: AmateurWorkRow,
  subscription: SubscriptionRow,
  delivered: Set<string>,
) {
  const deliveryKey = amateurMakerAlertDeliveryKey(alert.endpoint, alert.maker_name, work.content_id);
  if (!matchesAmateurMakerAlert(alert, work) || delivered.has(deliveryKey)) return null;

  try {
    await sendPushNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, { title: "発掘LAB：メーカーの新作です", body: `${alert.maker_name}の新しい素人作品「${work.title}」が登録されました。`, url: `/amateur/${encodeURIComponent(work.content_id)}`, tag: `amateur-maker-${alert.maker_name}` });
    const { error: deliveryError } = await supabaseAdmin.from("push_amateur_maker_alert_deliveries").insert({ endpoint: alert.endpoint, maker_name: alert.maker_name, content_id: work.content_id });
    if (deliveryError) throw deliveryError;
    delivered.add(deliveryKey);
    return "sent";
  } catch (error) {
    console.error("[push] amateur maker notification failed", { endpoint: alert.endpoint, contentId: work.content_id, maker: alert.maker_name, error });
    return "skipped";
  }
}

async function sendAmateurMakerAlertsToSubscription(
  alert: AmateurMakerAlertRule,
  subscription: SubscriptionRow,
  workRows: AmateurWorkRow[],
  delivered: Set<string>,
) {
  let sent = 0;
  let skipped = 0;
  for (const work of workRows) {
    const result = await sendAmateurMakerAlertWork(alert, work, subscription, delivered);
    if (result === "sent") sent += 1;
    if (result === "skipped") skipped += 1;
  }
  return { sent, skipped };
}

export async function notifyAmateurMakerAlertsForContentIds(contentIds: string[]) {
  const batch = await loadAmateurMakerAlertBatch(contentIds);
  if (!batch) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;
  for (const alert of batch.alertRows) {
    const subscription = batch.subscriptionByEndpoint.get(alert.endpoint);
    if (!subscription) {
      skipped += 1;
      continue;
    }
    const result = await sendAmateurMakerAlertsToSubscription(alert, subscription, batch.workRows, batch.delivered);
    sent += result.sent;
    skipped += result.skipped;
  }
  return { sent, skipped };
}
