import assert from "node:assert/strict";
import test from "node:test";
import { bijyoManualIdempotencyKey, bijyoReservedCandidateSince, buildBijyoMainText, buildBijyoReplyText, evaluateBijyoFutureOperation, filterRecentReleaseWorks, isBijyoFutureOperationEligible, isBijyoReservedCandidate, recentReleaseDateRange } from "./bijyoReservedWorkflow.ts";
import { BIJYO_SECTION_ORDER, HISTORY_PAGE_SIZE, MANUAL_CANDIDATE_INITIAL_LIMIT, MANUAL_CANDIDATE_PAGE_SIZE, UPCOMING_RELEASE_INITIAL_LIMIT, UPCOMING_RELEASE_PAGE_SIZE, historyBlockStart, visibleManualCandidateCount, visibleUpcomingReleaseCount } from "../app/admin/bijyo-reserved/ui.ts";

test("手動追加のidempotency keyは同じworkで安定する", () => {
  assert.equal(bijyoManualIdempotencyKey(283591), "bijyo1010:manual:283591");
  assert.equal(bijyoManualIdempotencyKey(283591), bijyoManualIdempotencyKey(283591));
});

test("本文と自己リプは固定フォーマット", () => {
  assert.equal(buildBijyoMainText({ title: "作品A", release_date: "2026-09-25" }), "【9月25日発売】\n作品A");
  assert.equal(buildBijyoReplyText(123), "👇作品の続き、セール価格推移はこちら\nhttps://amateur-lab.vercel.app/works/123");
});

test("今日から1週間はJSTの当日から7日後まで", () => {
  const range = recentReleaseDateRange(new Date("2026-09-21T00:30:00+09:00"));
  assert.deepEqual(range, { todayDate: "2026-09-21", startDate: "2026-09-21", endDate: "2026-09-28" });
  assert.deepEqual(recentReleaseDateRange(new Date("2026-09-20T15:30:00Z")), range);
  const works = [
    { id: 0, title: "昨日", stage: "RESERVED", created_at: "2026-09-20T01:00:00+09:00", release_date: "2026-09-20", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 1, title: "今日", stage: "RESERVED", created_at: "2026-09-21T01:00:00+09:00", release_date: "2026-09-21", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 2, title: "明日", stage: "RESERVED", created_at: "2026-09-20T01:00:00+09:00", release_date: "2026-09-22", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 3, title: "+7日", stage: "RESERVED", created_at: "2026-09-19T01:00:00+09:00", release_date: "2026-09-28", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
    { id: 4, title: "+8日", stage: "RESERVED", created_at: "2026-09-18T01:00:00+09:00", release_date: "2026-09-29", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null },
  ];
  assert.deepEqual(filterRecentReleaseWorks(works, [], range).map((work) => work.id), [1, 2, 3]);
});

test("今日だけNEWを許可し、明日以降はRESERVEDだけを許可する", () => {
  const range = { todayDate: "2026-09-28", startDate: "2026-09-28", endDate: "2026-10-05" };
  const work = (id: number, stage: string, release_date: string, sample_movie_url = "sample.mp4") => ({ id, title: `作品${id}`, stage, created_at: "2026-09-27T15:00:00Z", release_date, image_url: null, sample_movie_url, product_id: null });
  const result = filterRecentReleaseWorks([
    work(328387, "NEW", "2026-09-28"),
    work(2, "RESERVED", "2026-09-28"),
    work(3, "RESERVED", "2026-09-29"),
    work(4, "NEW", "2026-09-29"),
    work(5, "OLD", "2026-09-28"),
    work(6, "SEMI_NEW", "2026-09-28"),
    work(7, "RESERVED", "2026-09-27"),
    work(8, "RESERVED", "2026-10-05"),
    work(9, "RESERVED", "2026-10-06"),
  ], [], range);
  assert.deepEqual(result.map((item) => item.id), [2, 328387, 3, 8]);
});

test("futureの手動追加・スキップ操作ポリシーは今日のNEW/RESERVEDと未来のRESERVEDだけを許可する", () => {
  const range = { todayDate: "2026-09-28", startDate: "2026-09-28", endDate: "2026-10-05" };
  assert.equal(isBijyoFutureOperationEligible("NEW", "2026-09-28", range), true);
  assert.equal(isBijyoFutureOperationEligible("RESERVED", "2026-09-28", range), true);
  assert.equal(isBijyoFutureOperationEligible("RESERVED", "2026-09-29", range), true);
  assert.equal(isBijyoFutureOperationEligible("NEW", "2026-09-29", range), false);
  assert.equal(isBijyoFutureOperationEligible("OLD", "2026-09-28", range), false);
  assert.equal(isBijyoFutureOperationEligible("SEMI_NEW", "2026-09-28", range), false);
});

test("JST境界はtoday..today+7 inclusive、todayはNEW/RESERVED、未来はRESERVEDだけ", () => {
  const range = { todayDate: "2026-10-06", startDate: "2026-10-06", endDate: "2026-10-13" };
  assert.equal(evaluateBijyoFutureOperation("NEW", "2026-10-06", range).eligible, true);
  assert.equal(evaluateBijyoFutureOperation("RESERVED", "2026-10-06", range).eligible, true);
  assert.equal(evaluateBijyoFutureOperation("RESERVED", "2026-10-07", range).eligible, true);
  assert.equal(evaluateBijyoFutureOperation("NEW", "2026-10-07", range).eligible, false);
  assert.equal(evaluateBijyoFutureOperation("RESERVED", "2026-10-13", range).eligible, true);
  assert.equal(evaluateBijyoFutureOperation("RESERVED", "2026-10-14", range).eligible, false);
  assert.equal(evaluateBijyoFutureOperation("RESERVED", "2026-10-16", range).eligible, false);
});

test("今日のNEWでも既存除外と今日枠だけを除外し、他の今日NEWは残す", () => {
  const range = { todayDate: "2026-09-28", startDate: "2026-09-28", endDate: "2026-10-05" };
  const work = (id: number) => ({ id, title: `作品${id}`, stage: "NEW", created_at: "2026-09-28T00:00:00Z", release_date: "2026-09-28", image_url: null, sample_movie_url: "sample.mp4", product_id: null });
  const jobs = [
    { work_id: 2, kind: "auto", slot_date: "2026-09-27", status: "posted" },
    { work_id: 3, kind: "auto", slot_date: "2026-09-28", status: "pending" },
    { work_id: 4, kind: "auto", slot_date: "2026-09-28", status: "skipped" },
    { work_id: 5, kind: "auto", slot_date: "2026-09-28", status: "excluded" },
    { work_id: 6, kind: "manual", slot_date: "2026-09-28", status: "pending" },
  ];
  assert.deepEqual(filterRecentReleaseWorks([work(1), work(2), work(3), work(4), work(5), work(6)], jobs, range).map((item) => item.id), [1]);
});

test("投稿済み・スキップ・対象外・当日枠・manual追加・重複を除外し、発売日と登録日で安定ソートする", () => {
  const range = { todayDate: "2026-09-21", startDate: "2026-09-21", endDate: "2026-09-28" };
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
  const range = { todayDate: "2026-09-21", startDate: "2026-09-21", endDate: "2026-09-28" };
  const work = { id: 42, title: "手動追加対象", stage: "RESERVED", created_at: "2026-09-20T00:00:00Z", release_date: "2026-09-25", image_url: null, sample_movie_url: "sample.mp4", product_id: null };
  assert.deepEqual(filterRecentReleaseWorks([work], [], range).map((item) => item.id), [42]);
  assert.deepEqual(filterRecentReleaseWorks([work], [{ work_id: 42, kind: "manual", slot_date: "2026-09-21", status: "pending" }], range), []);
});

test("管理画面のセクション順とfuture初期表示件数を固定する", () => {
  assert.deepEqual(BIJYO_SECTION_ORDER, ["manual", "upcoming", "history"]);
  assert.equal(UPCOMING_RELEASE_INITIAL_LIMIT, 24);
  assert.equal(UPCOMING_RELEASE_PAGE_SIZE, 24);
  assert.equal(visibleUpcomingReleaseCount(222, 24), 24);
  assert.equal(visibleUpcomingReleaseCount(222, 48), 48);
  assert.equal(visibleUpcomingReleaseCount(10, 24), 10);
  assert.equal(MANUAL_CANDIDATE_INITIAL_LIMIT, 20);
  assert.equal(MANUAL_CANDIDATE_PAGE_SIZE, 20);
  assert.equal(visibleManualCandidateCount(0, 20), 0);
  assert.equal(visibleManualCandidateCount(1, 20), 1);
  assert.equal(visibleManualCandidateCount(20, 20), 20);
  assert.equal(visibleManualCandidateCount(21, 20), 20);
  assert.equal(visibleManualCandidateCount(40, 40), 40);
  assert.equal(visibleManualCandidateCount(41, 40), 40);
  assert.equal(HISTORY_PAGE_SIZE, 20);
  assert.equal(historyBlockStart(1), 1);
  assert.equal(historyBlockStart(2), 21);
  assert.equal(historyBlockStart(3), 41);
});

test("予約追加候補はcreated_atの7日窓だけを使い、発売日範囲やNEWを見ない", () => {
  const now = new Date("2026-10-07T00:00:00+09:00");
  const since = bijyoReservedCandidateSince(now);
  assert.equal(since, "2026-09-29T15:00:00.000Z");
  assert.equal(isBijyoReservedCandidate({ stage: "RESERVED", created_at: since, release_date: "2026-11-30" }, now), true);
  assert.equal(isBijyoReservedCandidate({ stage: "RESERVED", created_at: "2026-09-29T14:59:59.999Z", release_date: "2026-11-30" }, now), false);
  assert.equal(isBijyoReservedCandidate({ stage: "NEW", created_at: since, release_date: "2026-11-30" }, now), false);
});
