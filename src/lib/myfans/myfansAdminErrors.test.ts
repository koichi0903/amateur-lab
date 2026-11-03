import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMyfansAdminErrorContext,
  getSafeMyfansAdminErrorMessage,
} from "./myfansAdminErrors.ts";

test("MyFans管理ログはactionとPostgREST error codeだけを正規化する", () => {
  assert.deepEqual(buildMyfansAdminErrorContext("permanent_candidate_skip", {
    code: "42P10",
    message: "database detail is not exposed",
  }), {
    action: "permanent_candidate_skip",
    errorCode: "42P10",
    errorType: "UnknownError",
  });
  assert.deepEqual(buildMyfansAdminErrorContext("bad action!", { code: "secret-value" }), {
    action: "unknown",
    errorCode: undefined,
    errorType: "UnknownError",
  });
});

test("MyFans利用者には既知の入力案内だけを返し、内部errorは隠す", () => {
  assert.equal(
    getSafeMyfansAdminErrorMessage(new Error("対象日が不正です")),
    "対象日が不正です",
  );
  assert.equal(
    getSafeMyfansAdminErrorMessage(new Error("connection refused: secret host")),
    "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。",
  );
  assert.equal(
    getSafeMyfansAdminErrorMessage({ message: "対象日が不正です" }),
    "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。",
  );
});

test("MyFans利用者向け案内は許可済み文面との完全一致だけを返す", () => {
  assert.equal(
    getSafeMyfansAdminErrorMessage(new Error("商品が見つかりません。")),
    "商品が見つかりません。",
  );
  assert.equal(
    getSafeMyfansAdminErrorMessage(new Error("商品が見つかりません。 DB endpoint: secret")),
    "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。",
  );
  assert.equal(
    getSafeMyfansAdminErrorMessage(new Error("selectedは3件までです。4枠目を選ぶには、既存のselectedを見直してください。")),
    "selectedは3件までです。4枠目を選ぶには、既存のselectedを見直してください。",
  );
  assert.equal(
    getSafeMyfansAdminErrorMessage(new Error("selectedは3件までです。4枠目を選ぶには、既存のselectedを見直してください。 secret")),
    "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。",
  );
});
