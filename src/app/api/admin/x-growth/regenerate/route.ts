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
    includeDeferred: false,
  });
  return NextResponse.json({
    ok: true,
    topPicks: os.dailyTopPicks.length,
    elapsedMs: Date.now() - started,
    target: os.supplyDiagnostics.target,
  });
}
