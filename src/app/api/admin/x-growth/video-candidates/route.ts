import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { buildXGrowthVideoCandidateEvaluation } from "@/lib/xGrowthOS";
import { getRecentXPostLogs } from "@/lib/xPostLogs";
import {
  rankXGrowthVideoCandidates,
  X_GROWTH_VIDEO_SELECTION_LIMIT,
} from "@/lib/xGrowthVideoSelection";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { handleCandidatePost, type PersistedSelection, type SelectionSnapshot } from "./candidatePostHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  const logs = await getRecentXPostLogs();
  const evaluation = await buildXGrowthVideoCandidateEvaluation(logs.logs);
  const lastPostedAtByWorkId = new Map<number, string>();
  for (const log of logs.logs) {
    if (!Number.isSafeInteger(log.work_id) || !log.work_id || !log.posted_at) continue;
    const prior = lastPostedAtByWorkId.get(log.work_id);
    if (!prior || Date.parse(log.posted_at) > Date.parse(prior)) lastPostedAtByWorkId.set(log.work_id, log.posted_at);
  }
  const ranked = rankXGrowthVideoCandidates(evaluation.candidates.map((stage) => ({
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
  const passed = evaluation.hardGatePassedWorks;
  return {
    computedAt: new Date().toISOString(),
    evaluatedWorks: evaluation.evaluatedWorks,
    hardGatePassedWorks: passed,
    candidates: ranked,
    shortageReason: passed < X_GROWTH_VIDEO_SELECTION_LIMIT
      ? `Hard Gate通過は${passed}作品のため、5作品に${X_GROWTH_VIDEO_SELECTION_LIMIT - passed}作品不足しています。`
      : null,
    failureCounts: evaluation.failureCounts,
    pipeline: evaluation.pipeline,
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
  return handleCandidatePost(request, { isAdminRequest, readSelection, evaluateVideoPool, saveSelection });
}
