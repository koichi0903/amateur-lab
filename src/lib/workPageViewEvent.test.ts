import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkPageViewEvent } from "./workPageViewEvent";

test("rejects non-object payloads and invalid work IDs", () => {
  assert.deepEqual(parseWorkPageViewEvent(null), { kind: "invalid" });
  assert.deepEqual(parseWorkPageViewEvent("event"), { kind: "invalid" });
  assert.deepEqual(parseWorkPageViewEvent({ workId: 0 }), { kind: "invalid" });
  assert.deepEqual(parseWorkPageViewEvent({ workId: 1.5 }), { kind: "invalid" });
  assert.deepEqual(parseWorkPageViewEvent({ workId: Number.MAX_SAFE_INTEGER + 1 }), { kind: "invalid" });
});

test("validates the work ID before excluding operator landing traffic", () => {
  const externalAttribution = {
    channel: "internal",
    source: "admin",
    landingPath: "/admin/works?from=menu",
  };

  assert.deepEqual(
    parseWorkPageViewEvent({ workId: 0, externalAttribution }),
    { kind: "invalid" },
  );
  assert.deepEqual(
    parseWorkPageViewEvent({ workId: 42, externalAttribution }),
    { kind: "ignored" },
  );
});

test("normalizes attribution and keeps valid event fields for persistence", () => {
  const result = parseWorkPageViewEvent({
    workId: "42",
    sourcePage: "ranking",
    price: "780",
    discountRate: "15",
    discoveryScore: "92.5",
    ranking: "3",
    xPostKey: "  post-key  ",
    externalAttribution: {
      channel: "social",
      source: "Bluesky",
      landingPath: "/works/42?from=feed",
    },
  });

  assert.deepEqual(result, {
    kind: "record",
    eventRow: {
      work_id: 42,
      source_page: "ranking",
      price: 780,
      discount_rate: 15,
      discovery_score: 92.5,
      ranking: 3,
      x_post_key: "post-key",
      external_channel: "social",
      external_source: "bluesky",
      landing_path: "/works/42?from=feed",
    },
  });
});

test("uses direct attribution and nulls for invalid optional values", () => {
  const result = parseWorkPageViewEvent({
    workId: 42,
    sourcePage: "unrecognized",
    price: "not-a-number",
    discountRate: "",
    discoveryScore: null,
    ranking: true,
    xPostKey: "   ",
    externalAttribution: { channel: "unknown", source: "site", landingPath: "/works/42" },
  });

  assert.deepEqual(result, {
    kind: "record",
    eventRow: {
      work_id: 42,
      source_page: "direct",
      price: null,
      discount_rate: null,
      discovery_score: null,
      ranking: 1,
      x_post_key: null,
      external_channel: undefined,
      external_source: undefined,
      landing_path: undefined,
    },
  });
});

test("trims and caps X post keys to 120 characters", () => {
  const result = parseWorkPageViewEvent({ workId: 42, xPostKey: "  " + "x".repeat(125) + "  " });

  assert.equal(result.kind, "record");
  if (result.kind === "record") assert.equal(result.eventRow.x_post_key, "x".repeat(120));
});
