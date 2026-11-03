import assert from "node:assert/strict";
import test from "node:test";
import { parseManualXPostPayload } from "./xGrowthManualPostPayload.ts";

test("manual X post payload extracts the X post ID and preserves optional fields", () => {
  const parsed = parseManualXPostPayload({
    xPostUrl: " https://www.x.com/hakkutsu_lab/status/123456?ref=share ",
    workId: "42",
    candidateId: "candidate-1",
    slotId: "slot-2",
    candidateRank: "3",
    slotRole: "REACH",
    title: "Title",
    postText: "Main copy",
    intent: "work_link",
    trackingUrl: "https://example.test/work",
    mediaAssetId: "7",
    linkStrategy: "reply",
  });

  assert.deepEqual(parsed, {
    input: {
      workId: 42,
      candidateId: "candidate-1",
      slotId: "slot-2",
      candidateRank: "3",
      slotRole: "REACH",
      title: "Title",
      postText: "Main copy",
      intent: "work_link",
      xPostId: "123456",
      trackingUrl: "https://example.test/work",
      mediaAssetId: 7,
      linkStrategy: "reply",
    },
  });
});

test("manual X post payload keeps defaults and accepts twitter.com post URLs", () => {
  assert.deepEqual(parseManualXPostPayload({ xPostUrl: "http://twitter.com/user/status/987/" }), {
    input: {
      workId: Number.NaN,
      candidateId: null,
      slotId: null,
      candidateRank: null,
      slotRole: null,
      title: "FANZA X Growth投稿",
      postText: "",
      intent: null,
      xPostId: "987",
      trackingUrl: null,
      mediaAssetId: null,
      linkStrategy: null,
    },
  });
});

test("manual X post payload rejects non-status and non-X URLs", () => {
  const error = "作品ページのリンクを含むXポスト（自己リプにリンクした場合は自己リプ）のURLを入力してください。";
  assert.deepEqual(parseManualXPostPayload(null), { error });
  assert.deepEqual(parseManualXPostPayload({ xPostUrl: "https://x.com/user" }), { error });
  assert.deepEqual(parseManualXPostPayload({ xPostUrl: "https://example.com/user/status/123" }), { error });
});
