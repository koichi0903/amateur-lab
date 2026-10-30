import type { SerializedTopPick } from "./xGrowthDailyPlanSerialization";

type CandidateSelectionAuditInput = { slotId: string; candidateId: string; date: string };
type CandidateSelectionAuditRow = { work_id: number | null; intent: string | null } | null;

function selectionAuditIntent(pick: Partial<SerializedTopPick> | undefined, row: CandidateSelectionAuditRow) {
  if (row) return pick?.intent ?? row.intent ?? null;
  return pick?.intent ?? (pick as SerializedTopPick | undefined)?.role ?? null;
}

function selectionAuditSlotFields(pick: Partial<SerializedTopPick> | undefined) {
  return {
    slot_role: pick?.slotRole ?? null,
    candidate_rank: pick?.candidateRank ?? null,
  };
}

function selectionAuditWorkId(pick: Partial<SerializedTopPick> | undefined, row: CandidateSelectionAuditRow) {
  return pick?.workId ?? row?.work_id ?? null;
}

export function buildCandidateSelectionAuditIdentity(
  input: CandidateSelectionAuditInput,
  pick: Partial<SerializedTopPick> | undefined,
  row: CandidateSelectionAuditRow,
) {
  return {
    date: input.date,
    ...selectionAuditSlotFields(pick),
    slot_id: input.slotId,
    candidate_id: input.candidateId,
    work_id: selectionAuditWorkId(pick, row),
    intent: selectionAuditIntent(pick, row),
  };
}
