import assert from "node:assert/strict";
import test from "node:test";
import { calculateBijyoTrimStart } from "./bijyoTrim.ts";

function analysis({ blackEnd = 0, blankEnd = 0, evidence = [] }: { blackEnd?: number; blankEnd?: number; evidence?: Array<{ kind: "first_visual_change_sec" | "title_card_duration_sec"; value: number }> } = {}) {
  return { rawMetrics: { blackIntroEndSec: blackEnd, blankIntroEndSec: blankEnd }, videoEvidence: evidence, jacketEvidence: [] } as never;
}

test("black intro 0.8s => 2.8s", () => {
  const result = calculateBijyoTrimStart(analysis({ blankEnd: 0.8 }));
  assert.equal(result.trimStartSeconds, 2.8);
  assert.equal(result.reason, "intro_plus_2s");
});

test("white intro 1.2s => 3.2s", () => {
  const result = calculateBijyoTrimStart(analysis({ blankEnd: 1.2 }));
  assert.equal(result.trimStartSeconds, 3.2);
  assert.equal(result.reason, "intro_plus_2s");
});

test("immediate content => 0s", () => {
  const result = calculateBijyoTrimStart(analysis());
  assert.equal(result.trimStartSeconds, 0);
  assert.equal(result.reason, "none");
});

test("existing trim greater than intro padding wins", () => {
  const result = calculateBijyoTrimStart(analysis({ blankEnd: 0.8 }), 3.5);
  assert.equal(result.trimStartSeconds, 3.5);
  assert.equal(result.reason, "existing_analysis");
});

test("title card greater than intro padding wins", () => {
  const result = calculateBijyoTrimStart(analysis({ blankEnd: 0.8, evidence: [{ kind: "title_card_duration_sec", value: 3.5 }] }));
  assert.equal(result.trimStartSeconds, 3.5);
  assert.equal(result.reason, "title_card");
});

test("black intro 2.5s => 4.5s", () => {
  const result = calculateBijyoTrimStart(analysis({ blankEnd: 2.5 }));
  assert.equal(result.trimStartSeconds, 4.5);
  assert.equal(result.reason, "intro_plus_2s");
});

test("existing title analysis is kept without a blank intro", () => {
  const result = calculateBijyoTrimStart(analysis({ evidence: [{ kind: "first_visual_change_sec", value: 2.2 }, { kind: "title_card_duration_sec", value: 3.7 }] }));
  assert.equal(result.trimStartSeconds, 3.7);
  assert.equal(result.reason, "title_card");
});

test("first visual change alone does not trim immediate content", () => {
  const result = calculateBijyoTrimStart(analysis({ evidence: [{ kind: "first_visual_change_sec", value: 3 }] }));
  assert.equal(result.trimStartSeconds, 0);
  assert.equal(result.reason, "none");
});
