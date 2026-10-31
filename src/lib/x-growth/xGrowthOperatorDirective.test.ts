import assert from "node:assert/strict";
import test from "node:test";
import { parseDirective, type Directive } from "./xGrowthOperatorDirective";

const channel = {
  account: "hakkutsu_lab" as const,
  postKey: "post-1",
  url: "https://hakkutsu-lab.com/works/123?x_post=post-1&from=x",
};

function directive(overrides: Partial<Directive> = {}): Directive {
  return {
    version: 1,
    date: "2026-10-30",
    experiment: "  experiment  ",
    hypothesis: "  hypothesis  ",
    work: { id: 123, title: "Title" },
    evidence: ["evidence"],
    postText: "Post {{link}}",
    visualPlan: "Visual",
    channels: [channel],
    primaryMetric: "impressions",
    decisionDate: "2026-11-06",
    ...overrides,
  };
}

function encodeDirective(value: unknown): string {
  return `#directive=${encodeURIComponent(JSON.stringify(value))}`;
}

test("parseDirective validates and normalizes a supported directive", () => {
  const parsed = parseDirective(encodeDirective(directive()));

  assert.deepEqual(parsed, {
    ...directive(),
    experiment: "experiment",
    hypothesis: "hypothesis",
  });
});

test("parseDirective rejects malformed and incomplete payloads", () => {
  assert.equal(parseDirective("#directive=%7Bbad-json"), null);
  assert.equal(parseDirective(encodeDirective(null)), null);
  assert.equal(parseDirective(encodeDirective(directive({ version: 2 as 1 }))), null);
  assert.equal(parseDirective(encodeDirective(directive({ date: "2026/10/30" }))), null);
  assert.equal(parseDirective(encodeDirective({ ...directive(), work: undefined })), null);
  assert.equal(parseDirective(`directive=${"a".repeat(12001)}`), null);
});

test("parseDirective keeps valid channels and rejects links for another work", () => {
  const otherWorkChannel = {
    ...channel,
    postKey: "other-post",
    url: "https://hakkutsu-lab.com/works/999?x_post=other-post&from=x",
  };
  const parsed = parseDirective(encodeDirective(directive({ channels: [otherWorkChannel, channel] })));

  assert.deepEqual(parsed?.channels, [channel]);
  assert.equal(parseDirective(encodeDirective(directive({ channels: [otherWorkChannel] }))), null);
});

test("parseDirective rejects a post that exceeds the limit after its link is added", () => {
  const parsed = parseDirective(encodeDirective(directive({ postText: "x".repeat(950) })));
  assert.equal(parsed, null);
});

test("parseDirective applies the existing evidence and display-field limits", () => {
  const parsed = parseDirective(encodeDirective(directive({
    work: { id: 123, title: "t".repeat(300) },
    evidence: Array.from({ length: 10 }, () => "e".repeat(600)),
    visualPlan: "v".repeat(1500),
    primaryMetric: "m".repeat(400),
  })));

  assert.equal(parsed?.work?.title.length, 240);
  assert.equal(parsed?.evidence.length, 8);
  assert.equal(parsed?.evidence[0]?.length, 500);
  assert.equal(parsed?.visualPlan.length, 1200);
  assert.equal(parsed?.primaryMetric.length, 300);
});
