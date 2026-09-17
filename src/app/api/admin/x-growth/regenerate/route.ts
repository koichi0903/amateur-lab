import { NextResponse } from "next/server";
import { getAffiliateSalesAnalytics } from "@/lib/affiliateSalesAnalytics";
import { getFanzaXAccountGrowth } from "@/lib/fanzaXAccountGrowth";
import { buildXGrowthOS } from "@/lib/xGrowthOS";
import { getXCreativeLearning, getXPostOutcomes, getRecentXPostLogs } from "@/lib/xPostLogs";

export async function POST() {
  const started = Date.now();
  const [growth, salesAnalytics, logs, outcomes, creativeLearning] = await Promise.all([
    getFanzaXAccountGrowth(),
    getAffiliateSalesAnalytics(),
    getRecentXPostLogs(),
    getXPostOutcomes(),
    getXCreativeLearning(30),
  ]);
  const os = await buildXGrowthOS({
    growth,
    performance: salesAnalytics.performance,
    logs: logs.logs,
    outcomes: outcomes.outcomes,
    creativeLearning: creativeLearning.rows,
    includeDeferred: true,
  });
  return NextResponse.json({
    ok: true,
    topPicks: os.dailyTopPicks.length,
    elapsedMs: Date.now() - started,
    target: os.supplyDiagnostics.target,
    slotAllocation: os.supplyDiagnostics.slotAllocation,
    semanticSupply: os.supplyDiagnostics.semanticSupply,
    semanticSelected: os.supplyDiagnostics.semanticSelected,
    semanticQuotaOverflowReasons: os.supplyDiagnostics.semanticQuotaOverflowReasons,
    money: {
      generated: os.supplyDiagnostics.moneyGenerated,
      hardGatePassed: os.supplyDiagnostics.moneyHardGatePassed,
      eligible: os.supplyDiagnostics.moneyAllocationEligible,
      placed: os.supplyDiagnostics.moneyPlaced,
      topFailureReason: os.supplyDiagnostics.moneyTopFailureReason,
    },
    performanceTimings: os.performanceTimings,
  });
}
