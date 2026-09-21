import assert from "node:assert/strict";
import test from "node:test";
import { allocateTodaySlots, buildBijyoMainText, buildBijyoReplyText, filterRecentReleaseWorks, recentReleaseDateRange, todayProgress } from "./bijyoReservedWorkflow.ts";

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

test("直近1週間はJSTの今日を含む7日間だけ", () => {
  const range = recentReleaseDateRange(new Date("2026-09-21T00:30:00+09:00"));
  assert.deepEqual(range, { startDate: "2026-09-15", endDate: "2026-09-21" });
  const works = [
    { id: 1, title: "今日", stage: "RESERVED", created_at: "2026-09-21T01:00:00+09:00", release_date: "2026-09-21", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 2, title: "境界", stage: "RESERVED", created_at: "2026-09-20T01:00:00+09:00", release_date: "2026-09-15", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 3, title: "古い", stage: "RESERVED", created_at: "2026-09-14T01:00:00+09:00", release_date: "2026-09-14", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 4, title: "未来", stage: "RESERVED", created_at: "2026-09-22T01:00:00+09:00", release_date: "2026-09-22", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
  ];
  assert.deepEqual(filterRecentReleaseWorks(works, [], range).map((work) => work.id), [1, 2]);
});

test("投稿済み・スキップ・対象外・当日枠・manual追加・重複を除外し、発売日と登録日で安定ソートする", () => {
  const range = { startDate: "2026-09-15", endDate: "2026-09-21" };
  const work = (id: number, created_at: string) => ({ id, title: `作品${id}`, stage: "RESERVED", created_at, release_date: "2026-09-20", image_url: null, sample_movie_url: "sample.mp4", product_id: null });
  const jobs = [
    { work_id: 2, kind: "auto", slot_date: "2026-09-20", status: "posted" },
    { work_id: 3, kind: "auto", slot_date: "2026-09-20", status: "skipped" },
    { work_id: 4, kind: "auto", slot_date: "2026-09-20", status: "excluded" },
    { work_id: 5, kind: "auto", slot_date: "2026-09-21", status: "pending" },
    { work_id: 6, kind: "manual", slot_date: "2026-09-19", status: "pending" },
  ];
  const result = filterRecentReleaseWorks([work(1, "2026-09-20T03:00:00Z"), work(7, "2026-09-20T02:00:00Z"), work(1, "2026-09-20T01:00:00Z"), work(2, "2026-09-20T09:00:00Z"), work(3, "2026-09-20T09:00:00Z"), work(4, "2026-09-20T09:00:00Z"), work(5, "2026-09-20T09:00:00Z"), work(6, "2026-09-20T09:00:00Z")], jobs, range);
  assert.deepEqual(result.map((item) => item.id), [1, 7]);
});
