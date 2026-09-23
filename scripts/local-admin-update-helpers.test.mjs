import test from "node:test";
import assert from "node:assert/strict";
import {
  describeReadinessFailure,
  summarizeResponseBody,
} from "./local-admin-update-helpers.mjs";

test("summarizes readiness response bodies without logging unlimited output", () => {
  assert.equal(summarizeResponseBody("  one\n two  "), "one two");
  assert.equal(summarizeResponseBody("x".repeat(300)).length, 241);
});

test("includes phase, status, body, and timeout in readiness diagnostics", () => {
  const message = describeReadinessFailure({
    phase: "browser",
    status: 500,
    body: "Browser failed to start.",
    timeoutMs: 60_000,
  });
  assert.match(message, /phase=browser/);
  assert.match(message, /HTTP 500/);
  assert.match(message, /body=Browser failed to start\./);
  assert.match(message, /timeout=60000ms/);
});
