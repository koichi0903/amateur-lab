import assert from "node:assert/strict";
import type { SerializedTopPick } from "./xGrowthDailyPlanSerialization";
import { buildCandidateSelectionAuditIdentity } from "./xGrowthSelectionAudit";

const input = { date: "2026-10-31", slotId: "primary", candidateId: "candidate-1" };
const identity = buildCandidateSelectionAuditIdentity(input, {
  slotRole: "REACH",
  candidateRank: "A",
  candidateId: input.candidateId,
  workId: 42,
  intent: "MONEY",
  role: "MONEY",
} as Partial<SerializedTopPick>, null);
assert.deepEqual(identity, {
  date: input.date,
  slot_role: "REACH",
  slot_id: input.slotId,
  candidate_rank: "A",
  candidate_id: input.candidateId,
  work_id: 42,
  intent: "MONEY",
});

const fallbackIdentity = buildCandidateSelectionAuditIdentity(input, {
  role: "AUTHORITY",
} as Partial<SerializedTopPick>, { work_id: 55, intent: "creator_link" });
assert.equal(fallbackIdentity.work_id, 55);
assert.equal(fallbackIdentity.intent, "creator_link");

const emptyIdentity = buildCandidateSelectionAuditIdentity(input, undefined, null);
assert.equal(emptyIdentity.slot_role, null);
assert.equal(emptyIdentity.candidate_rank, null);
assert.equal(emptyIdentity.work_id, null);
assert.equal(emptyIdentity.intent, null);

console.log("X Growth Selection Audit tests passed");
