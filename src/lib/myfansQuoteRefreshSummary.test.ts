import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeMyfansQuoteRefreshItems } from "./myfansQuoteRefreshSummary";

test("quote refresh summary uses one definition for failed, blocked, and skipped", () => {
  assert.deepEqual(summarizeMyfansQuoteRefreshItems([
    { status: "success", error: null },
    { status: "failed", error: "EXECUTE_SCRIPT_NO_RESULT: undefined" },
    { status: "failed", error: "SENSITIVE_CONTENT_GATE: blocked" },
    { status: "skipped", error: "一括更新をキャンセルしました。" },
    { status: "skipped", error: "LOGIN_OR_CHALLENGE: login" },
    { status: "pending", error: null },
  ]), { processed: 5, success: 1, failed: 1, blocked: 2, skipped: 1 });
});
