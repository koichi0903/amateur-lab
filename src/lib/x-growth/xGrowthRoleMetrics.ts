import type { XGrowthIntent } from "./xGrowthTypes";

type RoleMetricVariant = {
  intent: XGrowthIntent;
  quality: {
    passed: boolean;
    lastMile: {
      humanVoice: { passed: boolean };
      nativeXVoice: { passed: boolean };
    };
  };
};

type RoleMetricOpportunity = {
  sourceType: string;
  creativeVariants: RoleMetricVariant[];
};

export type XGrowthRoleMetrics = {
  gateOkBySource: Record<string, number>;
  generatedBySource: Record<string, number>;
  humanVoiceNgBySource: Record<string, number>;
  nativeVoiceNgBySource: Record<string, number>;
  generatedByRole: Record<XGrowthIntent, number>;
  gateOkByRole: Record<XGrowthIntent, number>;
};

function incrementCount<T extends string>(counts: Record<T, number>, key: T) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function incrementUniqueRoles(counts: Record<XGrowthIntent, number>, variants: RoleMetricVariant[]) {
  for (const role of new Set(variants.map((variant) => variant.intent))) incrementCount(counts, role);
}

function recordSourceQualityMetrics(item: RoleMetricOpportunity, metrics: XGrowthRoleMetrics) {
  const variants = item.creativeVariants;
  if (variants.some((variant) => variant.quality.passed)) incrementCount(metrics.gateOkBySource, item.sourceType);
  incrementUniqueRoles(metrics.gateOkByRole, variants.filter((variant) => variant.quality.passed));
  if (variants.some((variant) => !variant.quality.lastMile.humanVoice.passed)) incrementCount(metrics.humanVoiceNgBySource, item.sourceType);
  if (variants.some((variant) => !variant.quality.lastMile.nativeXVoice.passed)) incrementCount(metrics.nativeVoiceNgBySource, item.sourceType);
}

export function buildXGrowthRoleMetricsFor(opportunities: readonly RoleMetricOpportunity[]) {
  const metrics: XGrowthRoleMetrics = {
    gateOkBySource: {},
    generatedBySource: {},
    humanVoiceNgBySource: {},
    nativeVoiceNgBySource: {},
    generatedByRole: { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 },
    gateOkByRole: { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 },
  };

  for (const item of opportunities) {
    incrementCount(metrics.generatedBySource, item.sourceType);
    incrementUniqueRoles(metrics.generatedByRole, item.creativeVariants);
    recordSourceQualityMetrics(item, metrics);
  }

  return metrics;
}
