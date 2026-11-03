import assert from "node:assert/strict";
import test from "node:test";
import { matchesQuoteRefreshJobIdentity, type QuoteRefreshRunIdentity } from "./myfansQuoteRefreshJobIdentity.ts";

const identity: QuoteRefreshRunIdentity = {
  sessionId: "session-1",
  runToken: "run-1",
  collectorVersion: "collector-v2",
};

const job = {
  collection_session_id: "session-1",
  collection_run_token: "run-1",
  collector_version: "collector-v2",
};

test("accepts a job only when all run identity fields match", () => {
  assert.equal(matchesQuoteRefreshJobIdentity(job, identity), true);
  assert.equal(matchesQuoteRefreshJobIdentity({ ...job, collection_session_id: "other" }, identity), false);
  assert.equal(matchesQuoteRefreshJobIdentity({ ...job, collection_run_token: "other" }, identity), false);
  assert.equal(matchesQuoteRefreshJobIdentity({ ...job, collector_version: "other" }, identity), false);
});

test("requires a job, session id, and run token", () => {
  assert.equal(matchesQuoteRefreshJobIdentity(null, identity), false);
  assert.equal(matchesQuoteRefreshJobIdentity(job, { ...identity, sessionId: "" }), false);
  assert.equal(matchesQuoteRefreshJobIdentity(job, { ...identity, runToken: "" }), false);
});
