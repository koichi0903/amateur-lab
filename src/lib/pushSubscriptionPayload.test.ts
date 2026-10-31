import assert from "node:assert/strict";
import test from "node:test";
import { validatePushSubscriptionPayload } from "./pushSubscriptionPayload.ts";

const validSubscription = {
  endpoint: " https://push.example.test/subscription ",
  keys: { p256dh: " key-p256dh ", auth: " key-auth " },
};

test("validates and normalizes a catalog work subscription", () => {
  const result = validatePushSubscriptionPayload({
    subscription: validSubscription,
    workId: "42" as unknown as number,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    body: { subscription: validSubscription, workId: "42" },
    endpoint: "https://push.example.test/subscription",
    p256dh: "key-p256dh",
    auth: "key-auth",
    kind: "work",
    workId: 42,
  });
});

test("requires HTTPS and bounded non-empty subscription keys", () => {
  const invalid = [
    { subscription: { ...validSubscription, endpoint: "http://push.example.test" }, workId: 42 },
    { subscription: { ...validSubscription, endpoint: "not a URL" }, workId: 42 },
    { subscription: { endpoint: validSubscription.endpoint, keys: { p256dh: "", auth: "key-auth" } }, workId: 42 },
    { subscription: { endpoint: validSubscription.endpoint, keys: { p256dh: "x".repeat(513), auth: "key-auth" } }, workId: 42 },
  ];

  for (const body of invalid) {
    const result = validatePushSubscriptionPayload(body);
    assert.deepEqual(result, { ok: false, message: "通知購読情報が不足しています" });
  }
});

test("validates amateur content IDs before persistence and keeps the amateur branch", () => {
  const accepted = validatePushSubscriptionPayload({
    subscription: validSubscription,
    mediaType: "amateur",
    contentId: " content-123 ",
    workId: 0,
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.value.kind, "amateur");
    if (accepted.value.kind === "amateur") assert.equal(accepted.value.contentId, "content-123");
  }

  assert.deepEqual(
    validatePushSubscriptionPayload({ subscription: validSubscription, mediaType: "amateur", contentId: " " }),
    { ok: false, message: "素人作品IDが正しくありません" },
  );
});

test("requires a positive safe work ID for catalog subscriptions", () => {
  for (const workId of [undefined, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(
      validatePushSubscriptionPayload({ subscription: validSubscription, workId }),
      { ok: false, message: "通知購読情報が不足しています" },
    );
  }
});
