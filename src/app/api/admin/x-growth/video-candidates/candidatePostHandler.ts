import { NextRequest, NextResponse } from "next/server";
import { chooseXGrowthVideoCandidates, X_GROWTH_VIDEO_SELECTION_LIMIT, type RankedVideoCandidate } from "@/lib/xGrowthVideoSelection";

export type SelectionSnapshot = {
  computedAt: string;
  evaluatedWorks: number;
  hardGatePassedWorks: number;
  candidates: RankedVideoCandidate[];
  shortageReason: string | null;
  failureCounts: Record<string, number>;
  pipeline: Record<string, number>;
};

export type PersistedSelection = {
  account_handle: string;
  selected_work_ids: number[];
  manual_override_work_ids: number[];
  excluded_work_ids: number[];
  candidate_snapshot: SelectionSnapshot;
  revision: number;
  updated_at: string;
};

export type CandidatePostDependencies = {
  isAdminRequest(request: NextRequest): Promise<boolean>;
  readSelection(): Promise<PersistedSelection | null>;
  evaluateVideoPool(): Promise<SelectionSnapshot>;
  saveSelection(
    expectedRevision: number,
    selectedWorkIds: number[],
    manualOverrideWorkIds: number[],
    excludedWorkIds: number[],
    candidateSnapshot: SelectionSnapshot,
  ): Promise<{ conflict: true; selection: null } | { conflict: false; selection: PersistedSelection }>;
};

type CandidatePostAction = "refresh" | "override" | "reset";
type CandidatePostCommand = {
  action: CandidatePostAction;
  expectedRevision: number;
  selectedWorkIds: unknown;
};

function isCandidatePostAction(value: unknown): value is CandidatePostAction {
  return value === "refresh" || value === "override" || value === "reset";
}

function parseCandidatePostCommand(value: unknown): CandidatePostCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as { action?: unknown; expectedRevision?: unknown; selectedWorkIds?: unknown };
  const { action, expectedRevision, selectedWorkIds } = body;
  if (!isCandidatePostAction(action) || typeof expectedRevision !== "number"
      || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return null;
  return { action, expectedRevision, selectedWorkIds };
}

type ManualSelectionResult =
  | { ok: true; manualOverrideWorkIds: number[]; excludedWorkIds: number[] }
  | { ok: false; status: 400 | 409; error: string };

function resolveManualSelection(selected: unknown, ranked: RankedVideoCandidate[]): ManualSelectionResult {
  if (!Array.isArray(selected) || selected.length > X_GROWTH_VIDEO_SELECTION_LIMIT
      || selected.some((id) => typeof id !== "number" || !Number.isSafeInteger(id))) {
    return { ok: false, status: 400, error: "入れ替える候補が正しくありません。" };
  }
  const uniqueIds = [...new Set(selected as number[])];
  const eligibleIds = new Set(ranked.map((candidate) => candidate.workId));
  if (uniqueIds.some((id) => !eligibleIds.has(id))) {
    return { ok: false, status: 409, error: "選択候補が最新評価のHard Gateを通過していません。候補を更新してください。" };
  }
  const automaticIds = new Set(ranked.slice(0, X_GROWTH_VIDEO_SELECTION_LIMIT).map((candidate) => candidate.workId));
  return {
    ok: true,
    manualOverrideWorkIds: uniqueIds.filter((id) => !automaticIds.has(id)),
    excludedWorkIds: [...automaticIds].filter((id) => !uniqueIds.includes(id)),
  };
}

type CandidateSelectionResult =
  | { ok: true; manualOverrideWorkIds: number[]; excludedWorkIds: number[]; selected: RankedVideoCandidate[] }
  | { ok: false; status: 400 | 409; error: string };

function buildCandidateSelection(command: CandidatePostCommand, current: PersistedSelection | null, ranked: RankedVideoCandidate[]): CandidateSelectionResult {
  let manualOverrideWorkIds = command.action === "reset" ? [] : (current?.manual_override_work_ids ?? []);
  let excludedWorkIds = command.action === "reset" ? [] : (current?.excluded_work_ids ?? []);

  if (command.action === "override") {
    const override = resolveManualSelection(command.selectedWorkIds, ranked);
    if (!override.ok) return override;
    manualOverrideWorkIds = override.manualOverrideWorkIds;
    excludedWorkIds = override.excludedWorkIds;
  }

  const eligibleIds = new Set(ranked.map((candidate) => candidate.workId));
  manualOverrideWorkIds = manualOverrideWorkIds.filter((id) => eligibleIds.has(id));
  excludedWorkIds = excludedWorkIds.filter((id) => eligibleIds.has(id));
  return {
    ok: true,
    manualOverrideWorkIds,
    excludedWorkIds,
    selected: chooseXGrowthVideoCandidates(ranked, manualOverrideWorkIds, excludedWorkIds),
  };
}

export async function handleCandidatePost(request: NextRequest, dependencies: CandidatePostDependencies) {
  if (!(await dependencies.isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const command = parseCandidatePostCommand(await request.json().catch(() => null));
  if (!command) {
    return NextResponse.json({ error: "候補の更新情報が正しくありません。画面を再読み込みしてください。" }, { status: 400 });
  }

  try {
    const current = await dependencies.readSelection();
    const currentRevision = current?.revision ?? 0;
    if (command.expectedRevision !== currentRevision) {
      return NextResponse.json({ error: "別の画面で候補が更新されました。再読み込みしてから操作してください。", conflict: true }, { status: 409 });
    }
    const snapshot = await dependencies.evaluateVideoPool();
    const ranked = snapshot.candidates;
    const selection = buildCandidateSelection(command, current, ranked);
    if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: selection.status });
    const saved = await dependencies.saveSelection(
      currentRevision,
      selection.selected.map((candidate) => candidate.workId),
      selection.manualOverrideWorkIds,
      selection.excludedWorkIds,
      snapshot,
    );
    if (saved.conflict) return NextResponse.json({ error: "候補の保存中に別の画面で更新がありました。再読み込みしてください。", conflict: true }, { status: 409 });
    return NextResponse.json({ ok: true, selection: saved.selection, selectedCandidates: selection.selected });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "候補の選定・保存に失敗しました。" }, { status: 500 });
  }
}
