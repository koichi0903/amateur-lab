import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAmateurXCandidateBrowseView,
  getAmateurXCandidateRankLabel,
  getAmateurXCandidateReleaseDate,
  getAmateurXCandidateStatusLabel,
  runAmateurXCandidateAction,
} from "./amateurXPostCandidateHelpers.ts";

test("candidate display helpers preserve rank, release date, and job status labels", () => {
  assert.equal(getAmateurXCandidateRankLabel(7), "人気順位 7位");
  assert.equal(getAmateurXCandidateRankLabel(null), "新作7日間");
  assert.equal(getAmateurXCandidateReleaseDate("2026-11-01T00:00:00Z"), "2026-11-01");
  assert.equal(getAmateurXCandidateReleaseDate(null), "未取得");
  assert.equal(getAmateurXCandidateStatusLabel("pending"), "投稿リストに追加済み（準備中）");
  assert.equal(getAmateurXCandidateStatusLabel("skipped"), "スキップ済み");
  assert.equal(getAmateurXCandidateStatusLabel("posted"), "投稿済み");
});

test("candidate browse view preserves lane copy, ordering, and empty-state behavior", () => {
  const candidates = [{ content_id: "one" }, { content_id: "two" }];
  const popular = buildAmateurXCandidateBrowseView({ candidates, total: 2, hasMore: true }, "popular", false);
  assert.deepEqual(popular.candidates, candidates);
  assert.equal(popular.countLabel, "2件");
  assert.equal(popular.laneDescription, "DMM人気順・MP4確認済み作品を最大500件");
  assert.equal(popular.isEmpty, false);
  assert.equal(popular.hasMore, true);

  const empty = buildAmateurXCandidateBrowseView(null, "new_release", false);
  assert.equal(empty.countLabel, "0件");
  assert.equal(empty.laneDescription, "JST直近7日間（今日を含む）・MP4確認済み作品。全アカウントの投稿済み・スキップ済みは除外");
  assert.equal(empty.isEmpty, true);
  assert.equal(empty.hasMore, false);
  assert.equal(buildAmateurXCandidateBrowseView(null, "new_release", true).isEmpty, false);
});

test("candidate skip sends its lane and refreshes the list after saving", async () => {
  const payloads: Record<string, unknown>[] = [];
  const busy: boolean[] = [];
  const messages: string[] = [];
  let refreshCount = 0;

  await runAmateurXCandidateAction({
    action: "skip_candidate",
    contentId: "work-7",
    lane: "popular",
    request: async (payload) => { payloads.push(payload); },
    refresh: async () => { refreshCount += 1; },
    setBusy: (value) => { busy.push(value); },
    setMessage: (value) => { messages.push(value); },
  });

  assert.deepEqual(payloads, [{ action: "skip_candidate", contentId: "work-7", lane: "popular" }]);
  assert.equal(refreshCount, 1);
  assert.deepEqual(busy, [true, false]);
  assert.deepEqual(messages, [""]);
});

test("candidate action reports a save error and restores the idle state", async () => {
  const busy: boolean[] = [];
  const messages: string[] = [];
  let refreshCount = 0;

  await runAmateurXCandidateAction({
    action: "skip_candidate",
    contentId: "work-8",
    lane: "new_release",
    request: async () => { throw new Error("skip save failed"); },
    refresh: async () => { refreshCount += 1; },
    setBusy: (value) => { busy.push(value); },
    setMessage: (value) => { messages.push(value); },
  });

  assert.equal(refreshCount, 0);
  assert.deepEqual(busy, [true, false]);
  assert.deepEqual(messages, ["", "skip save failed"]);
});
