import assert from "node:assert/strict";
import test from "node:test";
import { calculateBijyoTrimStart } from "./bijyoTrim.ts";

function analysis({ blackEnd = 0, evidence = [] }: { blackEnd?: number; evidence?: Array<{ kind: "first_visual_change_sec" | "title_card_duration_sec"; value: number }> } = {}) {
  return { rawMetrics: { blackIntroEndSec: blackEnd }, videoEvidence: evidence, jacketEvidence: [] } as never;
}

test("no detection => final 2.0", () => {
  assert.equal(calculateBijyoTrimStart(analysis()).trimStartSeconds, 2);
  assert.equal(calculateBijyoTrimStart(analysis()).reason, "minimum_2s");
});

test("black_end 0.8 => final 2.0", () => {
  assert.equal(calculateBijyoTrimStart(analysis({ blackEnd: 0.8 })).trimStartSeconds, 2);
});

test("title/existing 1.5 => final 2.0", () => {
  assert.equal(calculateBijyoTrimStart(analysis({ evidence: [{ kind: "title_card_duration_sec", value: 1.5 }] })).trimStartSeconds, 2);
});

test("existing trim 3.2 => final 3.2", () => {
  assert.equal(calculateBijyoTrimStart(analysis(), 3.2).trimStartSeconds, 3.2);
  assert.equal(calculateBijyoTrimStart(analysis(), 3.2).reason, "existing_analysis");
});

test("black/title 4.5 => final 4.5", () => {
  const result = calculateBijyoTrimStart(analysis({ blackEnd: 4.5, evidence: [{ kind: "title_card_duration_sec", value: 3.1 }] }));
  assert.equal(result.trimStartSeconds, 4.5);
  assert.equal(result.reason, "black_intro");
});

test("multiple detections use the furthest safe start", () => {
  assert.equal(calculateBijyoTrimStart(analysis({ evidence: [{ kind: "first_visual_change_sec", value: 2.2 }, { kind: "title_card_duration_sec", value: 3.7 }] })).trimStartSeconds, 3.7);
});
