import assert from "node:assert/strict";
import test from "node:test";
import { parseXPostLogPayload } from "./xPostLogPayload";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    postKey: "post-key",
    workId: "42",
    category: "sales",
    title: "A title",
    postText: "A post",
    postDate: "2026-10-30",
    creativeVariantId: "variant-1",
    hookType: "price_anomaly",
    imageStrategy: "original_work_image",
    linkStrategy: "body_link",
    ctaStrategy: "price_cta",
    accountHandle: "@bijyo1010",
    postIntent: "reply",
    scheduledSlot: " morning ",
    plannedAt: " 2026-10-30T09:00:00+09:00 ",
    ...overrides,
  };
}

test("parseXPostLogPayload preserves accepted fields and existing normalization", () => {
  const result = parseXPostLogPayload(payload({
    title: "t".repeat(350),
    postText: "p".repeat(1100),
    creativeVariantId: "v".repeat(170),
    scheduledSlot: "s".repeat(45),
  }));

  assert.deepEqual(result, {
    postKey: "post-key",
    workId: 42,
    category: "sales",
    title: "t".repeat(300),
    postText: "p".repeat(1000),
    postDate: "2026-10-30",
    creativeVariantId: "v".repeat(160),
    hookType: "price_anomaly",
    imageStrategy: "original_work_image",
    linkStrategy: "body_link",
    ctaStrategy: "price_cta",
    accountHandle: "hakkutsu_lab",
    postIntent: "reply",
    scheduledSlot: "s".repeat(40),
    plannedAt: "2026-10-30T09:00:00+09:00",
  });
});

test("parseXPostLogPayload rejects missing or invalid required fields", () => {
  assert.equal(parseXPostLogPayload(null), null);
  assert.equal(parseXPostLogPayload("text"), null);
  assert.equal(parseXPostLogPayload(payload({ category: "unknown" })), null);
  assert.equal(parseXPostLogPayload(payload({ workId: Number.MAX_SAFE_INTEGER + 1 })), null);
  assert.equal(parseXPostLogPayload(payload({ workId: 0 })), null);
  assert.equal(parseXPostLogPayload(payload({ title: "" })), null);
  assert.equal(parseXPostLogPayload(payload({ postText: "" })), null);
  assert.equal(parseXPostLogPayload(payload({ postDate: "2026/10/30" })), null);
});

test("parseXPostLogPayload defaults unknown optional values and keeps the account mapping", () => {
  const result = parseXPostLogPayload(payload({
    hookType: "unknown",
    imageStrategy: "unknown",
    linkStrategy: "unknown",
    ctaStrategy: "unknown",
    postIntent: "unknown",
    accountHandle: "other-account",
    scheduledSlot: "   ",
    plannedAt: "   ",
  }));

  assert.equal(result?.hookType, null);
  assert.equal(result?.imageStrategy, null);
  assert.equal(result?.linkStrategy, null);
  assert.equal(result?.ctaStrategy, null);
  assert.equal(result?.postIntent, "work_link");
  assert.equal(result?.accountHandle, "hakkutsu_lab");
  assert.equal(result?.scheduledSlot, null);
  assert.equal(result?.plannedAt, null);
});
