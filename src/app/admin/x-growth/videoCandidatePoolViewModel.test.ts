import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVideoCandidatePoolViewState,
  getVideoCandidateRefreshLabel,
  type SavedSelection,
  type VideoCandidate,
} from "./videoCandidatePoolViewModel.ts";

function candidate(workId: number): VideoCandidate {
  return {
    workId,
    title: `work ${workId}`,
    sampleUrlOfficial: true,
    hardGatePassed: true,
    firstDropReason: null,
    rankingScore: 1,
    freshnessScore: 1,
    discountRate: 0,
    saleEndAt: null,
    creativeQualityScore: 1,
    lastPostedAt: null,
    rankScore: 1,
    rankReasons: [],
  };
}

function selection(candidates: VideoCandidate[]): SavedSelection {
  return {
    account_handle: "example",
    selected_work_ids: [2, 1],
    manual_override_work_ids: [2],
    excluded_work_ids: [],
    candidate_snapshot: {
      computedAt: "2026-11-01T00:00:00.000Z",
      evaluatedWorks: candidates.length,
      hardGatePassedWorks: candidates.length,
      candidates,
      shortageReason: null,
      failureCounts: {},
      pipeline: {},
    },
    revision: 3,
    updated_at: "2026-11-01T00:00:00.000Z",
  };
}

test("candidate pool view state keeps empty-selection defaults", () => {
  assert.deepEqual(buildVideoCandidatePoolViewState(null, 0), {
    snapshot: null,
    selectedIds: [],
    selectedSet: new Set(),
    pageCount: 1,
    currentPage: 0,
    visibleCandidates: [],
  });
});

test("candidate pool view state clamps to the last page and preserves selected ids", () => {
  const candidates = Array.from({ length: 21 }, (_, index) => candidate(index + 1));
  const state = buildVideoCandidatePoolViewState(selection(candidates), 99);

  assert.equal(state.pageCount, 2);
  assert.equal(state.currentPage, 1);
  assert.deepEqual(state.visibleCandidates.map((item) => item.workId), [21]);
  assert.deepEqual(state.selectedIds, [2, 1]);
  assert.deepEqual(state.selectedSet, new Set([2, 1]));
});

test("candidate pool refresh label follows loading priority", () => {
  assert.equal(getVideoCandidateRefreshLabel(true, true, true), "保存済み候補を読み込み中…");
  assert.equal(getVideoCandidateRefreshLabel(false, true, true), "読み取り・自動選定・保存中…");
  assert.equal(getVideoCandidateRefreshLabel(false, false, true), "候補を更新して自動選定");
  assert.equal(getVideoCandidateRefreshLabel(false, false, false), "動画候補を自動選定");
});
