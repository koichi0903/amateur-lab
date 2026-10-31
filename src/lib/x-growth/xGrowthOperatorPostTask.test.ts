import assert from "node:assert/strict";
import test from "node:test";
import { operatorPostTaskConflict, validateOperatorPostTask } from "./xGrowthOperatorPostTask.ts";

const validPayload = {
  account: " HAKKUTSU_LAB ",
  postKey: " key-1 ",
  workId: "42",
  title: " Post title ",
  postText: " Post text ",
  postDate: "2026-10-30",
};

test("operator post task validation trims fields and normalizes the account", () => {
  assert.deepEqual(validateOperatorPostTask(validPayload), {
    account: "hakkutsu_lab",
    postKey: "key-1",
    workId: 42,
    title: "Post title",
    postText: "Post text",
    postDate: "2026-10-30",
  });
});

test("operator post task validation rejects invalid dates, identifiers and content sizes", () => {
  const error = "投稿タスクの内容が不正です。指示リンクを開き直してください。";
  assert.deepEqual(validateOperatorPostTask(null), { error });
  assert.deepEqual(validateOperatorPostTask({ ...validPayload, postDate: "2026-02-30" }), { error });
  assert.deepEqual(validateOperatorPostTask({ ...validPayload, postKey: "bad key" }), { error });
  assert.deepEqual(validateOperatorPostTask({ ...validPayload, workId: 0 }), { error });
  assert.deepEqual(validateOperatorPostTask({ ...validPayload, title: " " }), { error });
  assert.deepEqual(validateOperatorPostTask({ ...validPayload, postText: "x".repeat(1001) }), { error });
  assert.deepEqual(validateOperatorPostTask({ ...validPayload, postDate: "20261030" }), { error });
});

test("duplicate task comparison keeps current conflict fields", () => {
  const task = { account: "hakkutsu_lab", workId: 42, postText: "same copy" };
  assert.equal(operatorPostTaskConflict({ account_handle: "hakkutsu_lab", work_id: "42", post_text: "same copy" }, task), null);
  assert.equal(operatorPostTaskConflict({ account_handle: "bijyo1010", work_id: 42, post_text: "same copy" }, task), "同じ計測キーに別の投稿記録があります。キーを作り直してください。");
  assert.equal(operatorPostTaskConflict({ account_handle: "hakkutsu_lab", work_id: 43, post_text: "same copy" }, task), "同じ計測キーに別の投稿記録があります。キーを作り直してください。");
  assert.equal(operatorPostTaskConflict({ account_handle: "hakkutsu_lab", work_id: 42, post_text: "different copy" }, task), "同じ計測キーに別の投稿記録があります。キーを作り直してください。");
});
