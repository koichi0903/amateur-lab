import assert from "node:assert/strict";
import test from "node:test";
import { allocateTodaySlots, bijyoManualIdempotencyKey, buildBijyoMainText, buildBijyoReplyText, filterRecentReleaseWorks, recentReleaseDateRange, todayProgress } from "./bijyoReservedWorkflow.ts";
import { BIJYO_SECTION_ORDER, UPCOMING_RELEASE_INITIAL_LIMIT, UPCOMING_RELEASE_PAGE_SIZE, visibleUpcomingReleaseCount } from "../app/admin/bijyo-reserved/ui.ts";

test("手動追加のidempotency keyは同じworkで安定する", () => {
  assert.equal(bijyoManualIdempotencyKey(283591), "bijyo1010:manual:283591");
  assert.equal(bijyoManualIdempotencyKey(283591), bijyoManualIdempotencyKey(283591));
});

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

test("今後1週間はJSTの明日から7日後まで", () => {
  const range = recentReleaseDateRange(new Date("2026-09-21T00:30:00+09:00"));
  assert.deepEqual(range, { todayDate: "2026-09-21", startDate: "2026-09-22", endDate: "2026-09-28" });
  const works = [
    { id: 1, title: "今日", stage: "RESERVED", created_at: "2026-09-21T01:00:00+09:00", release_date: "2026-09-21", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 2, title: "明日", stage: "RESERVED", created_at: "2026-09-20T01:00:00+09:00", release_date: "2026-09-22", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 3, title: "+7日", stage: "RESERVED", created_at: "2026-09-19T01:00:00+09:00", release_date: "2026-09-28", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 4, title: "+8日", stage: "RESERVED", created_at: "2026-09-18T01:00:00+09:00", release_date: "2026-09-29", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
  ];
  assert.deepEqual(filterRecentReleaseWorks(works, [], range).map((work) => work.id), [2, 3]);
});

test("投稿済み・スキップ・対象外・当日枠・manual追加・重複を除外し、発売日と登録日で安定ソートする", () => {
  const range = { todayDate: "2026-09-21", startDate: "2026-09-22", endDate: "2026-09-28" };
  const work = (id: number, created_at: string, release_date = "2026-09-24") => ({ id, title: `作品${id}`, stage: "RESERVED", created_at, release_date, image_url: null, sample_movie_url: "sample.mp4", product_id: null });
  const jobs = [
    { work_id: 2, kind: "auto", slot_date: "2026-09-20", status: "posted" },
    { work_id: 3, kind: "auto", slot_date: "2026-09-20", status: "skipped" },
    { work_id: 4, kind: "auto", slot_date: "2026-09-20", status: "excluded" },
    { work_id: 5, kind: "auto", slot_date: "2026-09-21", status: "pending" },
    { work_id: 6, kind: "manual", slot_date: "2026-09-19", status: "pending" },
    { work_id: 8, kind: "manual", slot_date: "2026-09-19", status: "manual_posted" },
  ];
  const result = filterRecentReleaseWorks([work(1, "2026-09-20T03:00:00Z", "2026-09-24"), work(7, "2026-09-20T02:00:00Z", "2026-09-23"), work(1, "2026-09-20T01:00:00Z", "2026-09-24"), work(2, "2026-09-20T09:00:00Z"), work(3, "2026-09-20T09:00:00Z"), work(4, "2026-09-20T09:00:00Z"), work(5, "2026-09-20T09:00:00Z"), work(6, "2026-09-20T09:00:00Z"), work(8, "2026-09-20T09:00:00Z")], jobs, range);
  assert.deepEqual(result.map((item) => item.id), [7, 1]);
});

test("手動追加ジョブを作成するとfuture一覧から直ちに消える", () => {
  const range = { todayDate: "2026-09-21", startDate: "2026-09-22", endDate: "2026-09-28" };
  const work = { id: 42, title: "手動追加対象", stage: "RESERVED", created_at: "2026-09-20T00:00:00Z", release_date: "2026-09-25", image_url: null, sample_movie_url: "sample.mp4", product_id: null };
  assert.deepEqual(filterRecentReleaseWorks([work], [], range).map((item) => item.id), [42]);
  assert.deepEqual(filterRecentReleaseWorks([work], [{ work_id: 42, kind: "manual", slot_date: "2026-09-21", status: "pending" }], range), []);
});

test("管理画面のセクション順とfuture初期表示件数を固定する", () => {
  assert.deepEqual(BIJYO_SECTION_ORDER, ["today", "manual", "upcoming", "history"]);
  assert.equal(UPCOMING_RELEASE_INITIAL_LIMIT, 24);
  assert.equal(UPCOMING_RELEASE_PAGE_SIZE, 24);
  assert.equal(visibleUpcomingReleaseCount(222, 24), 24);
  assert.equal(visibleUpcomingReleaseCount(222, 48), 48);
  assert.equal(visibleUpcomingReleaseCount(10, 24), 10);
});
