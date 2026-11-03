import assert from "node:assert/strict";
import test from "node:test";
import { parseXGrowthPostRegistrationInput } from "./xGrowthPostRegistration.ts";

const postId = "2108542780159263207";

test("normalizes the post key, account casing, and X URL around the accepted payload", () => {
  assert.deepEqual(
    parseXGrowthPostRegistrationInput({
      postKey: "  daily-pick-1  ",
      account: "HAKKUTSU_LAB",
      xPostUrl: ` https://x.com/Another_User/status/${postId}?s=20 `,
    }),
    {
      postKey: "daily-pick-1",
      account: "hakkutsu_lab",
      post: { handle: "another_user", id: postId },
    },
  );
});

test("accepts the existing second account and trims its post key", () => {
  assert.deepEqual(
    parseXGrowthPostRegistrationInput({
      postKey: " key ",
      account: "BIJYO1010",
      xPostUrl: `https://twitter.com/bijyo1010/status/${postId}`,
    }),
    {
      postKey: "key",
      account: "bijyo1010",
      post: { handle: "bijyo1010", id: postId },
    },
  );
});

test("rejects malformed payloads, unsupported accounts, empty and overlong keys, and invalid URLs", () => {
  const valid = {
    postKey: "key",
    account: "hakkutsu_lab",
    xPostUrl: `https://x.com/hakkutsu_lab/status/${postId}`,
  };

  for (const payload of [
    null,
    [],
    { ...valid, postKey: "   " },
    { ...valid, postKey: "x".repeat(181) },
    { ...valid, account: "unknown" },
    { ...valid, account: " hakkutsu_lab " },
    { ...valid, xPostUrl: "http://x.com/hakkutsu_lab/status/2108542780159263207" },
    { ...valid, xPostUrl: "https://x.com.evil.example/hakkutsu_lab/status/2108542780159263207" },
  ]) {
    assert.equal(parseXGrowthPostRegistrationInput(payload), null);
  }
});
