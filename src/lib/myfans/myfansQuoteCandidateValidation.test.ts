import assert from "node:assert/strict";
import test from "node:test";
import { assertMyfansQuoteCandidateOwner } from "./myfansQuoteCandidateValidation";

test("accepts a status URL from the product creator, ignoring handle case", () => {
  assert.doesNotThrow(() => assertMyfansQuoteCandidateOwner("https://x.com/Creator", "https://twitter.com/creator/status/123"));
});

test("accepts an X status URL when the product has no creator URL", () => {
  assert.doesNotThrow(() => assertMyfansQuoteCandidateOwner(null, "https://x.com/creator/status/123?ref=profile"));
});

test("rejects non-HTTPS and non-status URLs", () => {
  assert.throws(() => assertMyfansQuoteCandidateOwner(null, "http://x.com/creator/status/123"), {
    message: "creator本人のX投稿URLを入力してください。",
  });
  assert.throws(() => assertMyfansQuoteCandidateOwner(null, "https://x.com/creator/status/no-id"), {
    message: "creator本人のX投稿URLを入力してください。",
  });
});

test("rejects a status URL belonging to another creator", () => {
  assert.throws(() => assertMyfansQuoteCandidateOwner("https://x.com/creator", "https://x.com/other/status/123"), {
    message: "creator本人のX投稿URLだけ登録できます。",
  });
});

test("keeps the existing fallback when the stored creator URL has no recognizable handle", () => {
  assert.doesNotThrow(() => assertMyfansQuoteCandidateOwner("not-a-profile-url", "https://x.com/creator/status/123"));
});
