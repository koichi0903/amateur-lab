import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuoteRefreshFinalStatus } from "./myfansQuoteRefreshItemStatus.ts";

const nonRetryableErrors = new Set(["LOGIN_OR_CHALLENGE", "PRIVATE"]);

test("quote refresh only retries retryable failures while attempts remain", () => {
  assert.deepEqual(resolveQuoteRefreshFinalStatus({
    status: "failed", errorCode: "HTTP_503", attempts: 2, nonRetryableErrors,
  }), { finalStatus: "pending", terminal: false });
  assert.deepEqual(resolveQuoteRefreshFinalStatus({
    status: "failed", errorCode: "HTTP_503", attempts: 3, nonRetryableErrors,
  }), { finalStatus: "failed", terminal: true });
});

test("non-retryable failures become skipped and successful results stay terminal", () => {
  assert.deepEqual(resolveQuoteRefreshFinalStatus({
    status: "failed", errorCode: "PRIVATE", attempts: 0, nonRetryableErrors,
  }), { finalStatus: "skipped", terminal: true });
  assert.deepEqual(resolveQuoteRefreshFinalStatus({
    status: "success", errorCode: "", attempts: 0, nonRetryableErrors,
  }), { finalStatus: "success", terminal: true });
});
