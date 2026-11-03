import assert from "node:assert/strict";
import test from "node:test";
import { classifyMyfansHoldReason } from "./myfansCandidateRecovery";

type HoldQuality = Parameters<typeof classifyMyfansHoldReason>[0];

function quality(options: {
  reasons?: string[];
  verdict?: "HOLD" | "PASS";
  firstLineStop?: number;
  specificity?: number;
  visual?: number;
  audience?: number;
} = {}): HoldQuality {
  return {
    reasons: options.reasons ?? [],
    verdict: options.verdict ?? "HOLD",
    breakdown: {
      firstLineStop: options.firstLineStop ?? 25,
      specificity: options.specificity ?? 100,
      visual: options.visual ?? 100,
      audience: options.audience ?? 100,
    },
  } as unknown as HoldQuality;
}

test("hold reason classification preserves priority and strict score boundaries", () => {
  const cases: Array<{ name: string; input: HoldQuality; expected: string }> = [
    { name: "topic value precedes visual cue", input: quality({ reasons: ["LOW_TOPIC_VALUE", "具体visualが不足"] }), expected: "LOW_TOPIC_VALUE" },
    { name: "visual cue reasons are recognized", input: quality({ reasons: ["abstract reaction", "concrete visual不足"] }), expected: "visual cue不足" },
    { name: "hook score below 25 is weak", input: quality({ reasons: ["First-line stopが低い"], firstLineStop: 24 }), expected: "hook弱い" },
    { name: "hook score at 25 falls through", input: quality({ reasons: ["First-line stopが低い"], firstLineStop: 25 }), expected: "First-line stopが低い" },
    { name: "specificity below 20 is weak", input: quality({ reasons: ["一般的"], specificity: 19 }), expected: "specificity弱い" },
    { name: "role evidence suppresses specificity hold", input: quality({ reasons: ["DISCOVERY"], specificity: 19 }), expected: "DISCOVERY" },
    { name: "visual below 12 is weak", input: quality({ reasons: ["その他"], visual: 11 }), expected: "visual弱い" },
    { name: "audience below 15 is unknown", input: quality({ reasons: ["その他"], visual: 12, audience: 14 }), expected: "audience不明" },
    { name: "template reasons are classified as sameness", input: quality({ reasons: ["テンプレ表現"] }), expected: "sameness高い" },
    { name: "HOLD plus publishable text is classified as sameness", input: quality({ reasons: ["公開可能"] }), expected: "sameness高い" },
    { name: "PASS plus publishable text falls through", input: quality({ reasons: ["公開可能"], verdict: "PASS" }), expected: "公開可能" },
    { name: "discovery difference is classified before revenue CTA", input: quality({ reasons: ["discovery差なし", "Revenue profile CTA"] }), expected: "discovery差なし" },
    { name: "revenue reason indicates weak profile CTA", input: quality({ reasons: ["Revenueの確認"] }), expected: "profile CTA弱い" },
    { name: "empty reasons use the generic fallback", input: quality(), expected: "Quality Gate未達" },
  ];

  for (const { name, input, expected } of cases) {
    assert.equal(classifyMyfansHoldReason(input), expected, name);
  }
});
