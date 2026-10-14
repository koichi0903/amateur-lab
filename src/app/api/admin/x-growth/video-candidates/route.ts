import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { buildXGrowthOS } from "@/lib/xGrowthOS";
import { getXCreativeLearning, getXPostOutcomes, getRecentXPostLogs } from "@/lib/xPostLogs";
import {
  chooseXGrowthVideoCandidates,
  rankXGrowthVideoCandidates,
  X_GROWTH_VIDEO_SELECTION_LIMIT,
  type RankedVideoCandidate,
} from "@/lib/xGrowthVideoSelection";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SelectionSnapshot = {
  computedAt: string;
  evaluatedWorks: number;
  hardGatePassedWorks: number;
  candidates: RankedVideoCandidate[];
  shortageReason: string | null;
  failureCounts: Record<string, number>;
  pipeline: Record<string, number>;
};

type PersistedSelection = {
  account_handle: string;
  selected_work_ids: number[];
  manual_override_work_ids: number[];
  excluded_work_ids: number[];
  candidate_snapshot: SelectionSnapshot;
  revision: number;
  updated_at: string;
};

type SelectionQuery = {
  select(columns: string): SelectionQuery;
  eq(column: string, value: string): SelectionQuery;
  maybeSingle(): Promise<{ data: PersistedSelection | null; error: { message: string } | null }>;
};

// The generated Supabase client types do not include this not-yet-migrated table/function.
const selectionDb = supabaseAdmin as unknown as {
  from(table: string): SelectionQuery;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

async function readSelection() {
  const { data, error } = await selectionDb
    .from("x_growth_video_candidate_selections")
    .select("account_handle,selected_work_ids,manual_override_work_ids,excluded_work_ids,candidate_snapshot,revision,updated_at")
    .eq("account_handle", "hakkutsu_lab")
    .maybeSingle();
  if (error) throw new Error("保存済みの動画候補を読み込めませんでした。");
  return (data ?? null) as PersistedSelection | null;
}

async function evaluateVideoPool(): Promise<SelectionSnapshot> {
  const [logs, outcomes, creativeLearning] = await Promise.all([
    getRecentXPostLogs(),
    getXPostOutcomes(),
    getXCreativeLearning(30),
  ]);
  const os = await buildXGrowthOS({
    // Growth aggregates include affiliate sales from unsettled scopes. This candidate-only evaluation
    // needs no account-level mission signal, so keep both sales inputs out of the ranking path.
    growth: {
      error: null,
      diagnosis: "露出不足",
      currentFollowers: 0,
      followersDelta30d: 0,
      newFollows30d: 0,
      profileVisits30d: 0,
      impressions30d: 0,
      posts30d: 0,
      avgImpressionsPerPost: null,
      xPageViews30d: 0,
      fanzaClicks30d: 0,
      salesCount30d: 0,
      commission30d: 0,
      ctr30d: null,
      cvr30d: null,
      epc30d: null,
      weeklyRows: [],
    },
    // Per-work affiliate performance uses scope 990; keep it out while attribution is unsettled.
    performance: [],
    logs: logs.logs,
    outcomes: outcomes.outcomes,
    creativeLearning: creativeLearning.rows,
    includeDeferred: false,
    readOnlyDryRun: true,
  });
  const lastPostedAtByWorkId = new Map<number, string>();
  for (const log of logs.logs) {
    if (!Number.isSafeInteger(log.work_id) || !log.work_id || !log.posted_at) continue;
    const prior = lastPostedAtByWorkId.get(log.work_id);
    if (!prior || Date.parse(log.posted_at) > Date.parse(prior)) lastPostedAtByWorkId.set(log.work_id, log.posted_at);
  }
  const ranked = rankXGrowthVideoCandidates(os.supplyDiagnostics.videoWorkStages.map((stage) => ({
    workId: stage.workId,
    title: stage.title,
    sampleUrlOfficial: stage.sampleUrlOfficial,
    hardGatePassed: stage.hardGatePassed,
    firstDropReason: stage.firstDropReason,
    rankingScore: stage.rankingScore,
    freshnessScore: stage.freshnessScore,
    discountRate: stage.discountRate,
    saleEndAt: stage.saleEndAt,
    creativeQualityScore: stage.creativeQualityScore,
  })), lastPostedAtByWorkId);
  const passed = os.supplyDiagnostics.pipeline.videoHardGatePassedWorks;
  return {
    computedAt: new Date().toISOString(),
    evaluatedWorks: os.supplyDiagnostics.pipeline.videoQualityEvaluatedWorks,
    hardGatePassedWorks: passed,
    candidates: ranked,
    shortageReason: passed < X_GROWTH_VIDEO_SELECTION_LIMIT
      ? `Hard Gate通過は${passed}作品のため、5作品に${X_GROWTH_VIDEO_SELECTION_LIMIT - passed}作品不足しています。`
      : null,
    failureCounts: os.supplyDiagnostics.videoQualityFailureCounts,
    pipeline: {
      candidateWorks: os.supplyDiagnostics.pipeline.videoCandidateWorks,
      expandedWorks: os.supplyDiagnostics.pipeline.videoExpandedWorks,
      scoreWindowWorks: os.supplyDiagnostics.pipeline.videoScoreWindowWorks,
      afterMediaWorks: os.supplyDiagnostics.pipeline.videoAfterMediaWorks,
      prefilterWorks: os.supplyDiagnostics.pipeline.videoPrefilterWorks,
      qualityEvaluatedWorks: os.supplyDiagnostics.pipeline.videoQualityEvaluatedWorks,
      hardGatePassedWorks: passed,
    },
  };
}

async function saveSelection(
  expectedRevision: number,
  selectedWorkIds: number[],
  manualOverrideWorkIds: number[],
  excludedWorkIds: number[],
  candidateSnapshot: SelectionSnapshot,
) {
  const result = await selectionDb.rpc("save_x_growth_video_candidate_selection", {
    p_expected_revision: expectedRevision,
    p_selected_work_ids: selectedWorkIds,
    p_manual_override_work_ids: manualOverrideWorkIds,
    p_excluded_work_ids: excludedWorkIds,
    p_candidate_snapshot: candidateSnapshot,
  });
  if (result.error) {
    if (result.error.code === "40001") return { conflict: true as const, selection: null };
    throw new Error("動画候補を保存できませんでした。migration適用状態を確認してください。");
  }
  const saved = Array.isArray(result.data) ? result.data[0] : result.data;
  return { conflict: false as const, selection: saved as PersistedSelection };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  try {
    const selection = await readSelection();
    return NextResponse.json({ ok: true, selection });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "候補を読み込めませんでした。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; expectedRevision?: unknown; selectedWorkIds?: unknown } | null;
  const action = body?.action;
  const expectedRevision = body?.expectedRevision;
  if (!(action === "refresh" || action === "override" || action === "reset")
      || typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return NextResponse.json({ error: "候補の更新情報が正しくありません。画面を再読み込みしてください。" }, { status: 400 });
  }

  try {
    const current = await readSelection();
    const currentRevision = current?.revision ?? 0;
    if (expectedRevision !== currentRevision) {
      return NextResponse.json({ error: "別の画面で候補が更新されました。再読み込みしてから操作してください。", conflict: true }, { status: 409 });
    }
    const snapshot = await evaluateVideoPool();
    const ranked = snapshot.candidates;
    let manualOverrideWorkIds = action === "reset" ? [] : (current?.manual_override_work_ids ?? []);
    let excludedWorkIds = action === "reset" ? [] : (current?.excluded_work_ids ?? []);

    if (action === "override") {
      const selected = body?.selectedWorkIds;
      if (!Array.isArray(selected) || selected.length > X_GROWTH_VIDEO_SELECTION_LIMIT
          || selected.some((id) => typeof id !== "number" || !Number.isSafeInteger(id))) {
        return NextResponse.json({ error: "入れ替える候補が正しくありません。" }, { status: 400 });
      }
      const uniqueIds = [...new Set(selected as number[])];
      const eligibleIds = new Set(ranked.map((candidate) => candidate.workId));
      if (uniqueIds.some((id) => !eligibleIds.has(id))) {
        return NextResponse.json({ error: "選択候補が最新評価のHard Gateを通過していません。候補を更新してください。" }, { status: 409 });
      }
      const automaticIds = new Set(ranked.slice(0, X_GROWTH_VIDEO_SELECTION_LIMIT).map((candidate) => candidate.workId));
      manualOverrideWorkIds = uniqueIds.filter((id) => !automaticIds.has(id));
      excludedWorkIds = [...automaticIds].filter((id) => !uniqueIds.includes(id));
    }

    const eligibleIds = new Set(ranked.map((candidate) => candidate.workId));
    manualOverrideWorkIds = manualOverrideWorkIds.filter((id) => eligibleIds.has(id));
    excludedWorkIds = excludedWorkIds.filter((id) => eligibleIds.has(id));
    const selected = chooseXGrowthVideoCandidates(ranked, manualOverrideWorkIds, excludedWorkIds);
    const saved = await saveSelection(
      currentRevision,
      selected.map((candidate) => candidate.workId),
      manualOverrideWorkIds,
      excludedWorkIds,
      snapshot,
    );
    if (saved.conflict) return NextResponse.json({ error: "候補の保存中に別の画面で更新がありました。再読み込みしてください。", conflict: true }, { status: 409 });
    return NextResponse.json({ ok: true, selection: saved.selection, selectedCandidates: selected });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "候補の選定・保存に失敗しました。" }, { status: 500 });
  }
}
