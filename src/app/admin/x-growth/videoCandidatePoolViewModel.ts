export type VideoCandidate = {
  workId: number;
  title: string;
  sampleUrlOfficial: boolean;
  hardGatePassed: boolean;
  firstDropReason: string | null;
  rankingScore: number;
  freshnessScore: number;
  discountRate: number;
  saleEndAt: string | null;
  creativeQualityScore: number;
  lastPostedAt: string | null;
  rankScore: number;
  rankReasons: string[];
};

export type SavedSelection = {
  account_handle: string;
  selected_work_ids: number[];
  manual_override_work_ids: number[];
  excluded_work_ids: number[];
  candidate_snapshot: {
    computedAt: string;
    evaluatedWorks: number;
    hardGatePassedWorks: number;
    candidates: VideoCandidate[];
    shortageReason: string | null;
    failureCounts: Record<string, number>;
    pipeline: Record<string, number>;
  };
  revision: number;
  updated_at: string;
};

export const CANDIDATES_PER_PAGE = 20;

export function buildVideoCandidatePoolViewState(selection: SavedSelection | null, candidatePage: number) {
  const snapshot = selection?.candidate_snapshot ?? null;
  const selectedIds = selection?.selected_work_ids ?? [];
  const candidates = snapshot?.candidates ?? [];
  const pageCount = Math.max(1, Math.ceil(candidates.length / CANDIDATES_PER_PAGE));
  const currentPage = Math.min(candidatePage, pageCount - 1);

  return {
    snapshot,
    selectedIds,
    selectedSet: new Set(selectedIds),
    pageCount,
    currentPage,
    visibleCandidates: candidates.slice(currentPage * CANDIDATES_PER_PAGE, (currentPage + 1) * CANDIDATES_PER_PAGE),
  };
}

export function getVideoCandidateRefreshLabel(initialLoading: boolean, loading: boolean, hasSelection: boolean) {
  if (initialLoading) return "保存済み候補を読み込み中…";
  if (loading) return "読み取り・自動選定・保存中…";
  return hasSelection ? "候補を更新して自動選定" : "動画候補を自動選定";
}
