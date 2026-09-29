import webpush from "web-push";

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = { title: string; body: string; url: string; tag?: string };

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) throw new Error("Push通知にはVAPID鍵が必要です");
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPushNotification(subscription: StoredPushSubscription, payload: PushPayload) {
  configureWebPush();
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 });
}
