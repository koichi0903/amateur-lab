import assert from "node:assert/strict";
import test from "node:test";
import {
  getPushSubscriptionErrorMessage,
  saveBrowserPushSubscription,
} from "./pushSubscriptionClient.ts";

test("push subscription保存APIへ通知別payloadを渡してtimeoutを解除する", async () => {
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  let timeoutMs = 0;
  let clearedTimer: number | undefined;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (_callback: TimerHandler, delay: number) => {
        timeoutMs = delay;
        return 42;
      },
      clearTimeout: (timer: number) => {
        clearedTimer = timer;
      },
    } satisfies Pick<Window, "setTimeout" | "clearTimeout">,
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    await saveBrowserPushSubscription(
      { toJSON: () => ({ endpoint: "https://push.example/subscription" }) } as PushSubscription,
      { mediaType: "amateur", contentId: "scute1583", priceAlert: true, makerAlerts: ["maker"] },
    );

    assert.equal(requestUrl, "/api/push/subscribe");
    assert.equal(requestInit?.method, "POST");
    assert.equal(requestInit?.headers && (requestInit.headers as Record<string, string>)["content-type"], "application/json");
    assert.deepEqual(JSON.parse(String(requestInit?.body)), {
      subscription: { endpoint: "https://push.example/subscription" },
      mediaType: "amateur",
      contentId: "scute1583",
      priceAlert: true,
      makerAlerts: ["maker"],
    });
    assert.ok(requestInit?.signal instanceof AbortSignal);
    assert.equal(timeoutMs, 15_000);
    assert.equal(clearedTimer, 42);
  } finally {
    if (originalFetch) Object.defineProperty(globalThis, "fetch", originalFetch);
    else Reflect.deleteProperty(globalThis, "fetch");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("push subscriptionのエラー表示はtimeoutと通常Errorを区別する", () => {
  assert.equal(
    getPushSubscriptionErrorMessage(new DOMException("aborted", "AbortError")),
    "通知設定の保存がタイムアウトしました。時間をおいて再度お試しください。",
  );
  assert.equal(getPushSubscriptionErrorMessage(new Error("permission denied")), "permission denied");
  assert.equal(getPushSubscriptionErrorMessage(null), "通知設定に失敗しました。");
});
