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
