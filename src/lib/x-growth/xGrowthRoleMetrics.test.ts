import assert from "node:assert/strict";
import test from "node:test";
import type { XGrowthIntent } from "./xGrowthTypes";
import { buildXGrowthRoleMetricsFor } from "./xGrowthRoleMetrics";

function variant(intent: XGrowthIntent, options: { quality?: boolean; humanVoice?: boolean; nativeXVoice?: boolean } = {}) {
  return {
    intent,
    quality: {
      passed: options.quality ?? true,
      lastMile: {
        humanVoice: { passed: options.humanVoice ?? true },
        nativeXVoice: { passed: options.nativeXVoice ?? true },
      },
    },
  };
}

test("counts unique roles per work and source-level quality failures once", () => {
  const metrics = buildXGrowthRoleMetricsFor([
    {
      sourceType: "MARKET",
      creativeVariants: [
        variant("REACH"),
        variant("REACH", { quality: false, humanVoice: false }),
        variant("MONEY", { nativeXVoice: false }),
      ],
    },
    { sourceType: "WORK", creativeVariants: [] },
  ]);

  assert.deepEqual(metrics, {
    gateOkBySource: { MARKET: 1 },
    generatedBySource: { MARKET: 1, WORK: 1 },
    humanVoiceNgBySource: { MARKET: 1 },
    nativeVoiceNgBySource: { MARKET: 1 },
    generatedByRole: { REACH: 1, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 1 },
    gateOkByRole: { REACH: 1, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 1 },
  });
});
