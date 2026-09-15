import { NextResponse } from "next/server";
import { getAffiliateSalesAnalytics } from "@/lib/affiliateSalesAnalytics";
import { getFanzaXAccountGrowth } from "@/lib/fanzaXAccountGrowth";
import { buildXGrowthOS } from "@/lib/xGrowthOS";
import { getXCreativeLearning, getXPostOutcomes, getRecentXPostLogs } from "@/lib/xPostLogs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
      supplyDiagnostics: os.supplyDiagnostics,
      nativeXLearning: os.nativeXLearning,
      mediaSupply: os.mediaSupply,
      rightsReviewQueue: os.rightsReviewQueue,
      conversationRadar: os.conversationRadar,
      learning: os.learning,
      opportunities: os.opportunities.slice(0, 12),
      audit: os.audit,
      performanceTimings: os.performanceTimings,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load deferred X Growth sections." },
      { status: 500 },
    );
  }
}
