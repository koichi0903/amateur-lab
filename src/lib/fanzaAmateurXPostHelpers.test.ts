import assert from "node:assert/strict";
import test from "node:test";
import { AMATEUR_X_POSTED_COOLDOWN_DAYS, AMATEUR_X_SHARED_QUEUE_ACCOUNT, amateurXPostJobStatusColumns, amateurXPostJobTextColumns, buildAmateurXReplyText, getLegacyAmateurXReplyTrackingKey, getRecentlyPostedContentIds, getXPostAccountHandle, mergeAmateurXCandidateJobs, withoutSkippedAmateurXCandidates } from "./fanzaAmateurXPostHelpers.ts";

test("new amateur X post jobs use the shared unassigned queue", () => {
  assert.equal(AMATEUR_X_SHARED_QUEUE_ACCOUNT, "unassigned");
});

test("maps generated post text to the database's snake_case columns", () => {
  assert.deepEqual(amateurXPostJobTextColumns({ mainText: "本文", replyText: "自己リプ" }), {
    main_text: "本文",
    reply_text: "自己リプ",
  });
});

test("records the account from the posted status URL on the shared queue job", () => {
  const xPostUrl = "https://x.com/bijyo1008/status/2115402960205500768?a=vdAwQbMjK4QurHWv5O8s%3D&s=20";
  assert.deepEqual(amateurXPostJobStatusColumns({
    status: "posted",
    xPostUrl,
    postedAt: "2026-10-29T00:00:00.000Z",
    mainText: "本文",
    replyText: "自己リプ",
  }), {
    status: "posted",
    account_handle: "bijyo1008",
    x_post_url: xPostUrl,
    posted_at: "2026-10-29T00:00:00.000Z",
    main_text: "本文",
    reply_text: "自己リプ",
  });
});

test("keeps skipped jobs in the shared queue account", () => {
  assert.deepEqual(amateurXPostJobStatusColumns({
    status: "skipped",
    postedAt: "2026-10-29T00:00:00.000Z",
  }), {
    status: "skipped",
    account_handle: AMATEUR_X_SHARED_QUEUE_ACCOUNT,
    x_post_url: null,
    posted_at: null,
  });
});

test("builds the shared promotional reply with title, current price, and tracked link", () => {
  const url = "https://hakkutsu-lab.com/amateur/mfcw066?from=x&x_post=amateur-test";
  assert.equal(buildAmateurXReplyText("SIO", 400, url), [
    "SIO",
    "💰400円〜",
    "✅PayPay払いOK",
    "✅初回は500円OFFクーポンあり",
    "",
    "続きはこちら👇（PR）",
    url,
  ].join("\n"));
  assert.equal(buildAmateurXReplyText("SIO", null, url).includes("💰"), false);
  const longTitleReply = buildAmateurXReplyText("作品名".repeat(100), 400, url);
  assert.ok(longTitleReply.length <= 280);
  assert.ok(longTitleReply.endsWith(url));
});

test("recognizes only an untouched legacy link-only reply for pending-job display refresh", () => {
  assert.equal(
    getLegacyAmateurXReplyTrackingKey("👇作品詳細・価格推移はこちら\nhttps://hakkutsu-lab.com/amateur/mfcw066?from=x&x_post=amateur-test", "mfcw066"),
    "amateur-test",
  );
  assert.equal(
    getLegacyAmateurXReplyTrackingKey("手動編集\n👇作品詳細・価格推移はこちら\nhttps://hakkutsu-lab.com/amateur/mfcw066?from=x&x_post=amateur-test", "mfcw066"),
    null,
  );
});

test("candidate status keeps shared skip history but prioritizes any account's pending job", () => {
  const skipped = { id: 1, content_id: "work-1", status: "skipped" as const };
  const pending = { id: 2, content_id: "work-1", status: "pending" as const };
  const sharedOnly = mergeAmateurXCandidateJobs([], [skipped]);
  assert.equal(sharedOnly.get("work-1")?.status, "skipped");

  const withPending = mergeAmateurXCandidateJobs([pending], [skipped]);
  assert.equal(withPending.get("work-1")?.id, pending.id);
  assert.equal(withPending.get("work-1")?.status, "pending");
});

test("skipped works disappear from their candidate list while keeping other candidates ordered", () => {
  const candidates = [{ content_id: "work-1" }, { content_id: "work-2" }, { content_id: "work-3" }];
  assert.deepEqual(withoutSkippedAmateurXCandidates(candidates, new Set(["work-2"])), [candidates[0], candidates[2]]);
});

test("popular candidates are cooled down for 30 days after posting and return at expiry", () => {
  const now = Date.UTC(2026, 9, 28, 12);
  const cooldownMs = AMATEUR_X_POSTED_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const recentlyPosted = getRecentlyPostedContentIds([
    { content_id: "recent", posted_at: new Date(now - cooldownMs + 1).toISOString() },
    { content_id: "older", posted_at: new Date(now - cooldownMs - 1).toISOString() },
    { content_id: "legacy-recent", posted_at: null, created_at: new Date(now - cooldownMs + 1).toISOString() },
    { content_id: "invalid", posted_at: "invalid-date", created_at: null },
  ], now);

  assert.deepEqual([...recentlyPosted], ["recent", "legacy-recent"]);
  assert.equal(recentlyPosted.has("older"), false);
  assert.equal(recentlyPosted.has("invalid"), false);
  assert.equal(getRecentlyPostedContentIds([
    { content_id: "expired-at-boundary", posted_at: new Date(now - cooldownMs).toISOString() },
  ], now).has("expired-at-boundary"), false);
});

test("extracts the actual account from an X post URL", () => {
  assert.equal(getXPostAccountHandle("https://x.com/Hakkutsu_Lab/status/12345"), "hakkutsu_lab");
  assert.equal(getXPostAccountHandle("https://twitter.com/bijyo1010/status/98765/"), "bijyo1010");
  assert.equal(getXPostAccountHandle("https://x.com/bijyo1008/status/2115402960205500768?a=vdAwQbMjK4QurHWv5O8s%3D&s=20"), "bijyo1008");
});

test("rejects URLs that do not identify a valid X post", () => {
  assert.equal(getXPostAccountHandle("https://x.com/handle"), null);
  assert.equal(getXPostAccountHandle("https://example.com/handle/status/123"), null);
  assert.equal(getXPostAccountHandle("http://x.com/handle/status/123"), null);
  assert.equal(getXPostAccountHandle("https://x.com/a-very-long-x-handle/status/123"), null);
});
