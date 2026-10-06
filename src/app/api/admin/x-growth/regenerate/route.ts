import { NextResponse } from "next/server";
import { getAffiliateSalesAnalytics } from "@/lib/affiliateSalesAnalytics";
import { getFanzaXAccountGrowth } from "@/lib/fanzaXAccountGrowth";
import { buildXGrowthOS } from "@/lib/xGrowthOS";
import { checkMediaAssetUrls, syncSampleMovieAssets } from "@/lib/xGrowthOperations";
import { getXCreativeLearning, getXPostOutcomes, getRecentXPostLogs } from "@/lib/xPostLogs";

export async function POST() {
  const started = Date.now();
  // Keep the network probe out of candidate scoring, but always complete the
  // lightweight asset sync and bounded technical check before a new plan is built.
  const mediaSync = await syncSampleMovieAssets(250);
  if (mediaSync.error) return NextResponse.json({ ok: false, error: mediaSync.error, mediaSync }, { status: 500 });
  const mediaCheck = await checkMediaAssetUrls(50);
  if (mediaCheck.error) return NextResponse.json({ ok: false, error: mediaCheck.error, mediaSync, mediaCheck }, { status: 500 });
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
    pipeline: os.supplyDiagnostics.pipeline,
    mediaSync,
    mediaCheck,
    mediaMix: os.supplyDiagnostics.mediaMix,
    diagnostics: os.supplyDiagnostics,
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
