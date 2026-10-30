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

export async function handleCandidatePost(request: NextRequest, dependencies: CandidatePostDependencies) {
  if (!(await dependencies.isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; expectedRevision?: unknown; selectedWorkIds?: unknown } | null;
  const action = body?.action;
  const expectedRevision = body?.expectedRevision;
  if (!(action === "refresh" || action === "override" || action === "reset")
      || typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return NextResponse.json({ error: "候補の更新情報が正しくありません。画面を再読み込みしてください。" }, { status: 400 });
  }

  try {
    const current = await dependencies.readSelection();
    const currentRevision = current?.revision ?? 0;
    if (expectedRevision !== currentRevision) {
      return NextResponse.json({ error: "別の画面で候補が更新されました。再読み込みしてから操作してください。", conflict: true }, { status: 409 });
    }
    const snapshot = await dependencies.evaluateVideoPool();
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
    const saved = await dependencies.saveSelection(
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
