import assert from "node:assert/strict";
import test from "node:test";

import {
  describeReviewUpdateError,
  isRetryableReviewUpdateError,
  withReviewDatabaseRetry,
} from "./reviewUpdateSupport.ts";

test("statement timeout errors retain their code and message", () => {
  const error = {
    code: "57014",
    message: "canceling statement due to statement timeout",
    details: null,
    hint: null,
  };

  assert.equal(isRetryableReviewUpdateError(error), true);
  assert.equal(
    describeReviewUpdateError(error),
    "code=57014 | canceling statement due to statement timeout",
  );
});

test("empty database errors receive a stable description", () => {
  assert.equal(
    describeReviewUpdateError({ message: "" }),
    "詳細のないデータベースエラー",
  );
});

test("retry helper retries transient failures", async () => {
  let calls = 0;
  const result = await withReviewDatabaseRetry(
    "test query",
    async () => {
      calls += 1;
      if (calls < 3) {
        throw { code: "57014", message: "statement timeout" };
      }
      return "ok";
    },
    { attempts: 3, delayMs: 0 },
  );

  assert.equal(result, "ok");
  assert.equal(calls, 3);
});
