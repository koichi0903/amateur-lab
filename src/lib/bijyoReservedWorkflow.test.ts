import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { BIJYO_RESERVED_REGISTRATION_WINDOW_MS, bijyoManualIdempotencyKey, buildBijyoMainText, buildBijyoReplyText, evaluateBijyoFutureOperation, filterBijyoReservedQueueWorks, filterRecentReleaseWorks, isBijyoFutureOperationEligible, isBijyoManualCandidate, isBijyoReservedQueueEligible, isBijyoReservedRegistrationRecent, pageBijyoReservedQueueWorks, recentReleaseDateRange } from "./bijyoReservedWorkflow.ts";
import { BIJYO_RESERVED_QUEUE_PAGE_SIZE, BIJYO_SECTION_ORDER, HISTORY_PAGE_SIZE, UPCOMING_RELEASE_INITIAL_LIMIT, UPCOMING_RELEASE_PAGE_SIZE, historyBlockStart, visibleUpcomingReleaseCount } from "../app/admin/bijyo-reserved/ui.ts";

test("手動追加のidempotency keyは同じworkで安定する", () => {
  assert.equal(bijyoManualIdempotencyKey(283591), "bijyo1010:manual:283591");
  assert.equal(bijyoManualIdempotencyKey(283591), bijyoManualIdempotencyKey(283591));
});

test("本文と自己リプは固定フォーマット", () => {
  assert.equal(buildBijyoMainText({ title: "作品A", release_date: "2026-09-25" }), "【9月25日発売】\n作品A");
  assert.equal(buildBijyoReplyText(123), "👇作品の続き、セール価格推移はこちら\nhttps://amateur-lab.vercel.app/works/123?from=x&x_post=bijyo1010-123");
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
  assert.deepEqual(BIJYO_SECTION_ORDER, ["manual", "upcoming", "reserved", "history"]);
  assert.equal(UPCOMING_RELEASE_INITIAL_LIMIT, 24);
  assert.equal(UPCOMING_RELEASE_PAGE_SIZE, 24);
  assert.equal(BIJYO_RESERVED_QUEUE_PAGE_SIZE, 24);
  assert.equal(visibleUpcomingReleaseCount(222, 24), 24);
  assert.equal(visibleUpcomingReleaseCount(222, 48), 48);
  assert.equal(visibleUpcomingReleaseCount(10, 24), 10);
  assert.equal(HISTORY_PAGE_SIZE, 20);
  assert.equal(historyBlockStart(1), 1);
  assert.equal(historyBlockStart(2), 21);
  assert.equal(historyBlockStart(3), 41);
});

test("予約作品一覧は全体を発売日降順・同日登録日時降順とID昇順で並べてからページ分割する", () => {
  const now = new Date("2026-10-10T00:00:00.000Z");
  const work = (id: number, stage: string, release_date: string, sample_movie_url = "https://www.dmm.co.jp/sample.mp4", created_at = `2026-10-09T12:00:0${id % 10}Z`) => ({ id, title: `作品${id}`, stage, created_at, release_date, image_url: null, sample_movie_url, product_id: null });
  const mockReservedWorks = [
    work(1, "RESERVED", "2026-10-11"),
    work(2, "RESERVED", "2026-10-10"),
    work(3, "NEW", "2026-10-12"),
    work(4, "RESERVED", "2026-10-09"),
    work(5, "RESERVED", "2026-11-01", ""),
    work(6, "RESERVED", "2026-12-01"),
    work(7, "RESERVED", "2026-10-11", "https://www.dmm.co.jp/sample.mp4", "2026-10-09T12:00:09Z"),
    work(8, "RESERVED", "2026-10-11", "https://www.dmm.co.jp/sample.mp4", "2026-10-09T12:00:09Z"),
  ];
  const mockBijyoJobs = [{ work_id: 6, kind: "manual", slot_date: "2026-10-09", status: "pending" }];
  assert.equal(isBijyoReservedQueueEligible("RESERVED", "2026-10-10", "2026-10-09"), true);
  assert.equal(isBijyoReservedQueueEligible("RESERVED", "2026-10-09", "2026-10-09"), false);
  assert.equal(isBijyoReservedQueueEligible("RESERVED", null, "2026-10-09"), false);
  assert.equal(isBijyoReservedQueueEligible("NEW", "2026-10-10", "2026-10-09"), false);
  assert.deepEqual(filterBijyoReservedQueueWorks(mockReservedWorks, mockBijyoJobs, "2026-10-09", now).map((item) => item.id), [7, 8, 1, 2]);
  assert.deepEqual(pageBijyoReservedQueueWorks(mockReservedWorks, mockBijyoJobs, "2026-10-09", 1, 2).works.map((item) => item.id), [7, 8]);
  assert.deepEqual(pageBijyoReservedQueueWorks(mockReservedWorks, mockBijyoJobs, "2026-10-09", 2, 2).works.map((item) => item.id), [1, 2]);
});

test("予約作品一覧は登録から168時間以内をUTC instantで判定し、発売前RESERVED・公式サンプル・未登録ジョブを保つ", () => {
  const now = new Date("2026-10-10T00:00:00.000Z");
  const cutoff = new Date(now.getTime() - BIJYO_RESERVED_REGISTRATION_WINDOW_MS).toISOString();
  assert.equal(cutoff, "2026-10-03T00:00:00.000Z");
  assert.equal(isBijyoReservedRegistrationRecent(cutoff, now), true);
  assert.equal(isBijyoReservedRegistrationRecent("2026-10-03T09:00:00+09:00", now), true);
  assert.equal(isBijyoReservedRegistrationRecent("2026-10-02T23:59:59.999Z", now), false);
  assert.equal(isBijyoReservedRegistrationRecent("2026-10-10T00:00:00.001Z", now), false);
  assert.equal(isBijyoReservedRegistrationRecent("invalid", now), false);
  const work = (id: number, overrides: Partial<{ stage: string; created_at: string; release_date: string; sample_movie_url: string }> = {}) => ({
    id, title: `作品${id}`, stage: "RESERVED", created_at: cutoff, release_date: "2026-10-11", image_url: null,
    sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null, ...overrides,
  });
  const works = [
    work(1),
    work(2, { created_at: "2026-10-02T23:59:59.999Z" }),
    work(3, { stage: "NEW" }),
    work(4, { release_date: "2026-10-10" }),
    work(5, { sample_movie_url: "" }),
    work(6, { release_date: "2030-01-01" }),
  ];
  const jobs = [{ work_id: 6, kind: "manual", slot_date: "2026-10-09", status: "pending" }];
  assert.deepEqual(filterBijyoReservedQueueWorks(works, jobs, "2026-10-10", now).map((item) => item.id), [1]);
});

test("手動追加候補はNEW/RESERVEDと登録日数を問わず、公式動画・発売日・未使用で判定する", () => {
  const oldNewWork = { stage: "NEW", created_at: "2024-01-01T00:00:00Z", release_date: "2026-10-09" };
  const oldReservedWork = { stage: "RESERVED", created_at: "2024-01-01T00:00:00Z", release_date: "2026-10-10" };
  assert.equal(isBijyoManualCandidate(oldNewWork, { officialSample: true, hasExistingJob: false }), true);
  assert.equal(isBijyoManualCandidate(oldReservedWork, { officialSample: true, hasExistingJob: false }), true);
  assert.equal(isBijyoManualCandidate({ stage: "OLD", release_date: "2026-10-09" }, { officialSample: true, hasExistingJob: false }), false);
  assert.equal(isBijyoManualCandidate(oldNewWork, { officialSample: false, hasExistingJob: false }), false);
  assert.equal(isBijyoManualCandidate(oldNewWork, { officialSample: true, hasExistingJob: true }), false);
  assert.equal(isBijyoManualCandidate({ stage: "NEW", release_date: null }, { officialSample: true, hasExistingJob: false }), false);
  assert.equal(isBijyoManualCandidate({ stage: "NEW", release_date: "invalid" }, { officialSample: true, hasExistingJob: false }), false);
});

test("発売予定一覧は投稿済み・追加済み・スキップ・除外を含む既存ジョブをすべて隠す", () => {
  const range = { todayDate: "2026-10-09", startDate: "2026-10-09", endDate: "2026-10-16" };
  const work = (id: number) => ({ id, title: `作品${id}`, stage: "RESERVED", created_at: "2026-10-01T00:00:00Z", release_date: "2026-10-12", image_url: null, sample_movie_url: "https://www.dmm.co.jp/sample.mp4", product_id: null });
  const statuses = ["pending", "posted", "manual_posted", "skipped", "excluded", "trim_failed"];
  const jobs = statuses.map((status, index) => ({ work_id: index + 1, kind: "auto", slot_date: "2026-10-12", status }));
  assert.deepEqual(filterRecentReleaseWorks([...jobs.map((job) => work(job.work_id)), work(7)], jobs, range).map((item) => item.id), [7]);
});

test("work_id 382555/382554相当の発売当日NEW作品は古い登録日でも手動追加候補になる", () => {
  const work = (id: number) => ({ id, stage: "NEW", created_at: "2026-08-01T00:00:00Z", release_date: "2026-10-09" });
  for (const id of [382555, 382554]) {
    assert.equal(isBijyoManualCandidate(work(id), { officialSample: true, hasExistingJob: false }), true);
  }
});

test("NEWの発売日範囲制限は発売予定一覧だけに適用し、手動追加は翌日以降も許可する", () => {
  const range = { todayDate: "2026-10-09", startDate: "2026-10-09", endDate: "2026-10-16" };
  assert.equal(evaluateBijyoFutureOperation("NEW", "2026-10-10", range).eligible, false);
  assert.equal(isBijyoManualCandidate({ stage: "NEW", release_date: "2026-10-10" }, { officialSample: true, hasExistingJob: false }), true);
  assert.equal(isBijyoManualCandidate({ stage: "RESERVED", release_date: "2026-10-10" }, { officialSample: true, hasExistingJob: false }), true);
});

test("公式動画・投稿/追加/スキップ/除外・重複状態を候補/APIで共通判定する", () => {
  const server = fs.readFileSync("src/lib/bijyoReservedAutoPost.ts", "utf8");
  const readPages = fs.readFileSync("src/lib/bijyoReadPages.ts", "utf8");
  const actions = fs.readFileSync("src/app/admin/bijyo-reserved/BijyoReservedActions.tsx", "utf8");
  const upcoming = fs.readFileSync("src/app/admin/bijyo-reserved/UpcomingBijyoReleases.tsx", "utf8");
  const queue = fs.readFileSync("src/app/admin/bijyo-reserved/ReservedBijyoWorks.tsx", "utf8");
  const workCard = fs.readFileSync("src/app/admin/bijyo-reserved/BijyoReservedWorkCard.tsx", "utf8");
  const candidate = { stage: "RESERVED", release_date: "2026-10-10" };
  assert.equal(isBijyoManualCandidate(candidate, { officialSample: true, hasExistingJob: false }), true);
  assert.match(server, /!isBijyoManualCandidate\(work,/);
  for (const status of ["pending", "posted", "manual_posted", "skipped", "excluded", "trim_failed"]) {
    assert.equal(isBijyoManualCandidate(candidate, { officialSample: true, hasExistingJob: true }), false, `${status} は候補に出さない`);
  }
  assert.match(server, /manualEligible: isBijyoManualCandidate\(work,/);
  assert.match(readPages, /\.eq\("stage", "RESERVED"\)/);
  assert.match(readPages, /\.gt\("release_date", today\)/);
  assert.match(readPages, /\.gte\("created_at", cutoff\)/);
  assert.match(readPages, /\.lte\("created_at", nowIso\)/);
  assert.match(readPages, /filter\(\(work\) =>/);
  assert.match(server, /!isBijyoManualCandidate\(work,/);
  assert.match(workCard, /allowWorkManualAdd=\{work\.manualEligible === true\}/);
  assert.match(actions, /workId && allowWorkManualAdd && <button[^\n]*run\("manual"\)/);
  assert.match(upcoming, /<BijyoReservedWorkCard key=\{work\.id\} work=\{work\} \/>/);
  assert.match(queue, /<BijyoReservedWorkCard key=\{work\.id\} work=\{work\} \/>/);
  assert.match(queue, /reservedPage=\$\{page \+ 1\}/);
});

test("手動追加カードは内部条件の長文を表示せず、サーバー側のeligible再検証を維持する", () => {
  const actions = fs.readFileSync("src/app/admin/bijyo-reserved/BijyoReservedActions.tsx", "utf8");
  const server = fs.readFileSync("src/lib/bijyoReservedAutoPost.ts", "utf8");
  assert.doesNotMatch(actions, /手動投稿には過去7日以内に登録されたRESERVED作品とFANZA\/DMM公式サンプル動画が必要です/);
  assert.match(server, /!isBijyoManualCandidate\(work,/);
  assert.match(server, /code: "candidate_unavailable"/);
  assert.match(server, /new Set\(jobs\.jobs\.map\(\(job\) => job\.work_id\)\)/);
});
