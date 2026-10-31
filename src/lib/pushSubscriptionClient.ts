type PushSubscribeConfig = {
  publicKey?: string;
  error?: string;
};

export async function createBrowserPushSubscription(): Promise<PushSubscription> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("このブラウザはプッシュ通知に対応していません。");
  }
  if (!window.isSecureContext) {
    throw new Error("通知にはHTTPS、またはlocalhostでのアクセスが必要です。");
  }

  const configResponse = await fetch("/api/push/subscribe");
  const config = (await configResponse.json()) as PushSubscribeConfig;
  if (!configResponse.ok || !config.publicKey) {
    throw new Error(config.error ?? "通知設定がまだ準備されていません。");
  }

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") {
    throw new Error("ブラウザの通知許可が必要です。");
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  const existing = await registration.pushManager.getSubscription();
  return existing ?? registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(
      atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
      (character) => character.charCodeAt(0),
    ),
  });
}

export async function saveBrowserPushSubscription(
  subscription: PushSubscription,
  payload: Record<string, unknown>,
): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), ...payload }),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }

  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "通知設定を保存できませんでした。");
}

export function getPushSubscriptionErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "通知設定の保存がタイムアウトしました。時間をおいて再度お試しください。";
  }
  if (error instanceof Error) return error.message;
  return "通知設定に失敗しました。";
}
