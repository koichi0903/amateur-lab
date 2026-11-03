import assert from "node:assert/strict";
import test from "node:test";
import {
  existingManualSnapshotConflict,
  validateManualImpressionPayload,
  validateManualPostAge,
} from "./xGrowthManualImpressions.ts";

test("manual impression payload trims post keys and accepts both configured accounts", () => {
  assert.deepEqual(validateManualImpressionPayload({
    postKey: " post-1 ",
    account: "bijyo1010",
    impressions: 0,
  }), { postKey: "post-1", account: "bijyo1010", impressions: 0 });
  assert.deepEqual(validateManualImpressionPayload({
    postKey: "post-2",
    account: "hakkutsu_lab",
    impressions: 1_000_000_000,
  }), { postKey: "post-2", account: "hakkutsu_lab", impressions: 1_000_000_000 });
});

test("manual impression payload rejects missing, oversized, unsupported and non-integer values", () => {
  const message = "投稿情報が正しくありません。画面を再読み込みしてください。";
  assert.deepEqual(validateManualImpressionPayload(null), { error: message });
  assert.deepEqual(validateManualImpressionPayload({ postKey: " ", account: "hakkutsu_lab", impressions: 1 }), { error: message });
  assert.deepEqual(validateManualImpressionPayload({ postKey: "x".repeat(181), account: "hakkutsu_lab", impressions: 1 }), { error: message });
  assert.deepEqual(validateManualImpressionPayload({ postKey: "post", account: "other", impressions: 1 }), { error: message });

  const countMessage = "Xに表示された閲覧数を0以上の整数で入力してください。";
  for (const impressions of [-1, 1.5, 1_000_000_001, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(validateManualImpressionPayload({ postKey: "post", account: "hakkutsu_lab", impressions }), { error: countMessage });
  }
});

test("manual snapshot timing excludes before 24 hours and at or after 30 days", () => {
  const postedAt = new Date("2026-10-01T00:00:00.000Z");
  assert.deepEqual(validateManualPostAge(postedAt.toISOString(), new Date(postedAt.getTime() + 23.9 * 60 * 60 * 1000)), {
    error: "投稿からまだ23.9時間です。24時間後に記録してください。",
  });
  assert.deepEqual(validateManualPostAge(postedAt.toISOString(), new Date(postedAt.getTime() + 24 * 60 * 60 * 1000)), { ageHours: 24 });
  assert.deepEqual(validateManualPostAge(postedAt.toISOString(), new Date(postedAt.getTime() + 30 * 24 * 60 * 60 * 1000)), {
    error: "投稿から720.0時間経過しています。手入力は投稿後30日以内に行ってください。",
  });
});

test("existing snapshot conflicts preserve account-first error precedence", () => {
  assert.equal(existingManualSnapshotConflict({ account_handle: "other", source: "api" }, "hakkutsu_lab"), "この投稿キーは別のアカウントの表示数に使われています。");
  assert.equal(existingManualSnapshotConflict({ account_handle: "hakkutsu_lab", source: "api" }, "hakkutsu_lab"), "すでに別の方法で記録されています。上書きしませんでした。");
  assert.equal(existingManualSnapshotConflict({ account_handle: "hakkutsu_lab", source: "manual" }, "hakkutsu_lab"), null);
  assert.equal(existingManualSnapshotConflict(null, "hakkutsu_lab"), null);
});
