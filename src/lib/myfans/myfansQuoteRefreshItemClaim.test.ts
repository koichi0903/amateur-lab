import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteRefreshItemClaim } from "./myfansQuoteRefreshItemClaim.ts";

test("claim increments attempts and clears stale item result fields", () => {
  assert.deepEqual(
    buildQuoteRefreshItemClaim(
      2,
      "2026-11-01T01:02:03.004Z",
      "2026-11-01T01:02:03.005Z",
    ),
    {
      status: "running",
      attempts: 3,
      processed_at: "2026-11-01T01:02:03.004Z",
      started_at: "2026-11-01T01:02:03.005Z",
      finished_at: null,
      request_type: "quote_scan",
      result_code: null,
      http_status: null,
      diagnostics: {},
      error: null,
    },
  );
});
