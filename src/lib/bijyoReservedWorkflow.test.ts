import assert from "node:assert/strict";
import test from "node:test";
import { allocateTodaySlots, buildBijyoMainText, buildBijyoReplyText, todayProgress } from "./bijyoReservedWorkflow.ts";

test("本文と自己リプは固定フォーマット", () => {
  assert.equal(buildBijyoMainText({ title: "作品A", release_date: "2026-09-25" }), "【9月25日発売】\n作品A");
  assert.equal(buildBijyoReplyText(123), "👇続きはこちら\nhttps://amateur-lab.vercel.app/works/123");
});

test("新着優先で4枠に割り当て、過去7日候補を繰り越す", () => {
  const slots = allocateTodaySlots({ date: "2026-09-19", candidates: [{ id: 1, created_at: "2026-09-19T00:00:00Z" }, { id: 2, created_at: "2026-09-18T00:00:00Z" }, { id: 3, created_at: "2026-09-17T00:00:00Z" }, { id: 4, created_at: "2026-09-16T00:00:00Z" }, { id: 5, created_at: "2026-09-15T00:00:00Z" }], existingJobs: [] });
  assert.deepEqual(slots.map((slot) => slot.workId), [1, 5, 4, 3]);
});

test("投稿済み・重複作品を除外し、空いた枠に補充する", () => {
  const existingJobs = [{ work_id: 1, status: "posted", slot_index: 0, kind: "auto" as const }, { work_id: 2, status: "skipped", slot_index: 1, kind: "auto" as const }];
  const slots = allocateTodaySlots({ date: "2026-09-19", candidates: [{ id: 1, created_at: "2026-09-19" }, { id: 2, created_at: "2026-09-19" }, { id: 3, created_at: "2026-09-19" }], existingJobs });
  assert.deepEqual(slots.map((slot) => slot.workId), [3]);
});

test("手動追加は本日の4枠に数えず、不足を正直に返す", () => {
  const progress = todayProgress([{ slot_date: "2026-09-19", kind: "auto", status: "manual_posted" }, { slot_date: "2026-09-19", kind: "manual", status: "manual_posted" }], "2026-09-19");
  assert.deepEqual(progress, { posted: 1, target: 4, remaining: 3, shortage: 3 });
});
