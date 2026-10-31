import assert from "node:assert/strict";
import test from "node:test";
import { classifyQuoteRefreshNextItemGate, type QuoteRefreshNextItemJobIdentity } from "./myfansQuoteRefreshNextItemGate.ts";

const input = {
  sessionId: "session-1",
  runToken: "token-1",
  collectorVersion: "collector-1",
};

function job(overrides: Partial<QuoteRefreshNextItemJobIdentity> = {}): QuoteRefreshNextItemJobIdentity {
  return {
    status: "running",
    collection_session_id: input.sessionId,
    collection_run_token: input.runToken,
    collector_version: input.collectorVersion,
    ...overrides,
  };
}

test("quote refresh next-item gate preserves missing job and identity checks", () => {
  assert.equal(classifyQuoteRefreshNextItemGate({ ...input, job: null }), "no_job");
  assert.equal(classifyQuoteRefreshNextItemGate({ ...input, job: job(), sessionId: "" }), "identity_mismatch");
  assert.equal(classifyQuoteRefreshNextItemGate({ ...input, job: job({ collection_run_token: "other" }) }), "identity_mismatch");
});

test("quote refresh next-item gate preserves paused, cancelled, and inactive status order", () => {
  assert.equal(classifyQuoteRefreshNextItemGate({ ...input, job: job({ status: "paused" }) }), "paused");
  assert.equal(classifyQuoteRefreshNextItemGate({ ...input, job: job({ status: "cancelled" }) }), "cancelled");
  assert.equal(classifyQuoteRefreshNextItemGate({ ...input, job: job({ status: "completed" }) }), "inactive");
  assert.equal(classifyQuoteRefreshNextItemGate({ ...input, job: job() }), null);
});
