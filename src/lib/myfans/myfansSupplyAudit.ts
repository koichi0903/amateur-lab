import { daysBetweenDates } from "@/lib/myfans/myfansTime";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import type { MyfansSourceValue } from "@/lib/myfansSourceValue";

export type MyfansSupplyAuditStage =
  | "source_discovery"
  | "source_value"
  | "freshness_cooldown"
  | "identity"
  | "visual"
  | "topic_value"
  | "reason_to_care"
  | "role_fit"
  | "copy"
  | "duplicate_similarity"
  | "quality_last_mile"
  | "selected";

export type MyfansSupplyAuditRow = {
  candidate_id: string;
  source_id: string | number | null;
  slot: string | null;
  stage: MyfansSupplyAuditStage;
  status: "passed" | "rejected" | "selected";
  reason_code: string;
  detail: string;
  score: number | null;
  threshold: number | null;
  source_url: string | null;
  source_author: string | null;
  product_id: number | null;
  role: string | null;
};

export type MyfansSupplyAuditRole = "ATTENTION" | "DISCOVERY" | "AUTHORITY" | "REVENUE";

export type MyfansSupplyAudit = {
  version: 1;
  stages: Array<{
    stage: MyfansSupplyAuditStage;
    input: number;
    passed: number;
    rejected: number;
    unique_candidates: number;
    unique_passed: number;
    top_reasons: Array<{ reason_code: string; count: number }>;
  }>;
  by_slot: Array<{
    slot: string;
    counts: Array<{ stage: MyfansSupplyAuditStage; input: number; passed: number; rejected: number }>;
    top_reasons: Array<{ stage: MyfansSupplyAuditStage; reason_code: string; count: number }>;
  }>;
  rows: MyfansSupplyAuditRow[];
};

export type MyfansSupplyAuditTopicRow = {
  productId: number;
  quoteCandidateId: number | null;
  role: MyfansSupplyAuditRole;
  sourceCandidate: string | null;
  topicValue: {
    verdict: "PASS" | "LOW_TOPIC_VALUE";
    score: number;
    reasonToCare: string | null;
    whyRejected: string[];
  };
};

export type MyfansSupplyAuditRecoveryRow = {
  candidateId: string;
  quoteCandidateId: number | null;
  slot: string;
  verdict: string;
  score: number;
  holdReason: string;
  qualityReasons: string[];
  recoveryAction: string;
  productId: number | null;
  recoveryRole: string;
};

export type MyfansSupplyAuditCandidate = {
  id: string;
  quoteXUrl: string;
  sourceXUrl: string;
  plannedSlot: string;
  quality: { total: number };
  sourceAuthorHandle: string;
  product: MyfansProduct | null;
  dailyRole: string;
};

type MyfansSupplyAuditInput = {
  sourceRows: MyfansAnalytics["quoteCandidates"];
  topicRows: MyfansSupplyAuditTopicRow[];
  recoveryHistory: MyfansSupplyAuditRecoveryRow[];
  finalPublishableCandidates: MyfansSupplyAuditCandidate[];
  rotation: Array<{ slot: string }>;
  planDate: string;
  pastUsage: {
    latestSource: (sourceUrl: string) => { date: string; actualPosted: boolean } | null | undefined;
  };
  helpers: {
    sourceValueForQuote: (quote: MyfansQuoteCandidate) => MyfansSourceValue;
    daysSinceIsoAtPlanDate: (value: string | null | undefined, planDate: string) => number | null;
    quoteUrlFromCandidate: (quote: MyfansQuoteCandidate) => string;
    visualPriority: (quote: MyfansQuoteCandidate) => number;
    topicThresholdFor: (role: MyfansSupplyAuditRole) => number;
    dailyFreshDays: number;
    postedSourceCooldownDays: number;
    quoteMinScore: number;
    qualityGateMinimum: number;
  };
};

type MyfansSupplyAuditWriter = (row: MyfansSupplyAuditRow) => void;

function sourceDiscoveryAuditRow(quote: MyfansAnalytics["quoteCandidates"][number], candidateId: string, sourceId: string | number, sourceUrl: string | null): MyfansSupplyAuditRow {
  return { candidate_id: candidateId, source_id: sourceId, slot: null, stage: "source_discovery", status: "passed", reason_code: "SOURCE_DISCOVERED", detail: "DBに保存済みのquote candidate", score: quote.score ?? null, threshold: null, source_url: sourceUrl, source_author: quote.source_x_handle ?? null, product_id: quote.product_id ?? null, role: null };
}

function sourceValueAuditRow(quote: MyfansAnalytics["quoteCandidates"][number], sourceValue: MyfansSourceValue, candidateId: string, sourceId: string | number, sourceUrl: string | null): MyfansSupplyAuditRow {
  const passed = sourceValue.verdict === "PASS";
  const detail = passed ? sourceValue.reasons.join(" / ") : `ランキング減点のみ。${sourceValue.reasons.join(" / ")}`;
  return { candidate_id: candidateId, source_id: sourceId, slot: null, stage: "source_value", status: "passed", reason_code: passed ? "SOURCE_VALUE_PASS" : "LOW_SOURCE_VALUE", detail, score: sourceValue.score, threshold: null, source_url: sourceUrl, source_author: quote.source_x_handle ?? null, product_id: quote.product_id ?? null, role: null };
}

function sourceIsStale(quote: MyfansAnalytics["quoteCandidates"][number], input: MyfansSupplyAuditInput) {
  const age = input.helpers.daysSinceIsoAtPlanDate(quote.posted_at ?? quote.collected_at, input.planDate);
  return quote.is_repost || (age !== null && age > input.helpers.dailyFreshDays);
}

function sourceIsCoolingDown(quote: MyfansAnalytics["quoteCandidates"][number], input: MyfansSupplyAuditInput) {
  const sourceUsage = input.pastUsage.latestSource(quote.x_post_url) ?? input.pastUsage.latestSource(input.helpers.quoteUrlFromCandidate(quote));
  const sourceAge = sourceUsage ? daysBetweenDates(input.planDate, sourceUsage.date) : null;
  return Boolean(quote.last_used_at || quote.cooldown_until || (sourceUsage && sourceAge !== null && sourceAge < input.helpers.postedSourceCooldownDays));
}

function freshnessReason(quote: MyfansAnalytics["quoteCandidates"][number], stale: boolean, coolingDown: boolean) {
  if (stale) return quote.is_repost ? "REPOST_SOURCE" : "STALE_SOURCE";
  return coolingDown ? "SOURCE_COOLDOWN" : "FRESH_COOLDOWN_PASS";
}

function freshnessDetail(stale: boolean, coolingDown: boolean) {
  if (stale) return "freshness/repost条件未達";
  return coolingDown ? "sourceまたは使用履歴のcooldown" : "freshかつcooldown通過";
}

function freshnessAuditRow(quote: MyfansAnalytics["quoteCandidates"][number], input: MyfansSupplyAuditInput, candidateId: string, sourceId: string | number, sourceUrl: string | null): MyfansSupplyAuditRow {
  const stale = sourceIsStale(quote, input);
  const coolingDown = sourceIsCoolingDown(quote, input);
  return { candidate_id: candidateId, source_id: sourceId, slot: null, stage: "freshness_cooldown", status: stale || coolingDown ? "rejected" : "passed", reason_code: freshnessReason(quote, stale, coolingDown), detail: freshnessDetail(stale, coolingDown), score: null, threshold: input.helpers.dailyFreshDays, source_url: sourceUrl, source_author: quote.source_x_handle ?? null, product_id: quote.product_id ?? null, role: null };
}

function visualAuditRow(quote: MyfansAnalytics["quoteCandidates"][number], input: MyfansSupplyAuditInput, candidateId: string, sourceId: string | number, sourceUrl: string | null): MyfansSupplyAuditRow {
  const passed = input.helpers.visualPriority(quote) >= 1 || (quote.views ?? 0) >= 50_000;
  return { candidate_id: candidateId, source_id: sourceId, slot: null, stage: "visual", status: passed ? "passed" : "rejected", reason_code: passed ? "VISUAL_OR_SIGNAL_PASS" : "VISUAL_OR_PUBLIC_SIGNAL_MISSING", detail: passed ? "visualまたは公開反応シグナルあり" : "visual/公開反応シグナル不足", score: quote.score ?? null, threshold: input.helpers.quoteMinScore, source_url: sourceUrl, source_author: quote.source_x_handle ?? null, product_id: quote.product_id ?? null, role: null };
}

function appendSourceAuditRows(quote: MyfansAnalytics["quoteCandidates"][number], input: MyfansSupplyAuditInput, addAudit: MyfansSupplyAuditWriter) {
  const sourceId = quote.id ?? quote.x_post_url;
  const sourceUrl = quote.x_post_url || quote.media_permalink || null;
  const candidateId = `source:${sourceId}`;
  addAudit(sourceDiscoveryAuditRow(quote, candidateId, sourceId, sourceUrl));
  const sourceValue = input.helpers.sourceValueForQuote(quote);
  addAudit(sourceValueAuditRow(quote, sourceValue, candidateId, sourceId, sourceUrl));
  addAudit(freshnessAuditRow(quote, input, candidateId, sourceId, sourceUrl));
  addAudit(visualAuditRow(quote, input, candidateId, sourceId, sourceUrl));
}

function appendTopicAuditRows(row: MyfansSupplyAuditTopicRow, input: MyfansSupplyAuditInput, addAudit: MyfansSupplyAuditWriter) {
  const candidateId = `topic:${row.productId}:${row.role}`;
  const passed = row.topicValue.verdict === "PASS";
  addAudit({ candidate_id: candidateId, source_id: row.quoteCandidateId, slot: null, stage: "topic_value", status: passed ? "passed" : "rejected", reason_code: passed ? "TOPIC_VALUE_PASS" : "LOW_TOPIC_VALUE", detail: passed ? "Topic Value threshold通過" : row.topicValue.whyRejected.join(" / ") || "Topic Value threshold未達", score: row.topicValue.score, threshold: input.helpers.topicThresholdFor(row.role), source_url: row.sourceCandidate || null, source_author: null, product_id: row.productId, role: row.role });
  addAudit({ candidate_id: candidateId, source_id: row.quoteCandidateId, slot: null, stage: "reason_to_care", status: row.topicValue.reasonToCare ? "passed" : "rejected", reason_code: row.topicValue.reasonToCare ? "REASON_TO_CARE_PRESENT" : "REASON_TO_CARE_MISSING", detail: row.topicValue.reasonToCare ? row.topicValue.reasonToCare : "公開文にできるreason_to_careなし", score: row.topicValue.score, threshold: null, source_url: row.sourceCandidate || null, source_author: null, product_id: row.productId, role: row.role });
}

function appendRecoveryAuditRow(attempt: MyfansSupplyAuditRecoveryRow, qualityGateMinimum: number, addAudit: MyfansSupplyAuditWriter) {
  const rejected = attempt.verdict !== "PASS" || attempt.score < qualityGateMinimum;
  const stage: MyfansSupplyAuditStage = /同じ|similar|duplicate|重複|sameness/i.test(attempt.holdReason) ? "duplicate_similarity" : "quality_last_mile";
  addAudit({ candidate_id: attempt.candidateId, source_id: attempt.quoteCandidateId, slot: attempt.slot, stage, status: rejected ? "rejected" : "passed", reason_code: rejected ? attempt.holdReason || "QUALITY_GATE_HOLD" : "QUALITY_GATE_PASS", detail: attempt.qualityReasons.join(" / ") || attempt.recoveryAction, score: attempt.score, threshold: qualityGateMinimum, source_url: null, source_author: null, product_id: attempt.productId, role: attempt.recoveryRole });
}

function appendSelectedAuditRow(candidate: MyfansSupplyAuditCandidate, qualityGateMinimum: number, addAudit: MyfansSupplyAuditWriter) {
  addAudit({ candidate_id: candidate.id, source_id: candidate.quoteXUrl || candidate.sourceXUrl || null, slot: candidate.plannedSlot, stage: "selected", status: "selected", reason_code: "SELECTED", detail: "quality gate通過後にslotへ採用", score: candidate.quality.total, threshold: qualityGateMinimum, source_url: candidate.quoteXUrl || candidate.sourceXUrl || null, source_author: candidate.sourceAuthorHandle || null, product_id: candidate.product?.id ?? null, role: candidate.dailyRole });
}

function reasonCounts(rows: MyfansSupplyAuditRow[]) {
  return Object.entries(rows.reduce<Record<string, number>>((acc, row) => { acc[row.reason_code] = (acc[row.reason_code] ?? 0) + 1; return acc; }, {})).map(([reason_code, count]) => ({ reason_code, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}

function uniqueCandidateCounts(rows: MyfansSupplyAuditRow[]) {
  const candidates = new Set(rows.map((row) => row.candidate_id));
  const passed = new Set(rows.filter((row) => row.status === "passed" || row.status === "selected").map((row) => row.candidate_id));
  return { unique_candidates: candidates.size, unique_passed: passed.size };
}

function buildStageSummary(rows: MyfansSupplyAuditRow[]): MyfansSupplyAudit["stages"] {
  return (["source_discovery", "source_value", "freshness_cooldown", "identity", "visual", "topic_value", "reason_to_care", "role_fit", "copy", "duplicate_similarity", "quality_last_mile", "selected"] as MyfansSupplyAuditStage[]).map((stage) => {
    const stageRows = rows.filter((row) => row.stage === stage);
    const passed = stageRows.filter((row) => row.status === "passed" || row.status === "selected").length;
    return { stage, input: stageRows.length, passed, rejected: stageRows.filter((row) => row.status === "rejected").length, ...uniqueCandidateCounts(stageRows), top_reasons: reasonCounts(stageRows) };
  });
}

function buildSlotSummary(rotation: Array<{ slot: string }>, rows: MyfansSupplyAuditRow[]): MyfansSupplyAudit["by_slot"] {
  return rotation.map((item) => {
    const slotRows = rows.filter((row) => row.slot === item.slot);
    const counts = (["copy", "duplicate_similarity", "quality_last_mile", "selected"] as MyfansSupplyAuditStage[]).map((stage) => {
      const stageRows = slotRows.filter((row) => row.stage === stage);
      return { stage, input: stageRows.length, passed: stageRows.filter((row) => row.status !== "rejected").length, rejected: stageRows.filter((row) => row.status === "rejected").length };
    });
    return { slot: item.slot, counts, top_reasons: counts.flatMap((count) => reasonCounts(slotRows.filter((row) => row.stage === count.stage)).map((reason) => ({ stage: count.stage, ...reason }))).slice(0, 5) };
  });
}

export function buildMyfansSupplyAudit(input: MyfansSupplyAuditInput): MyfansSupplyAudit {
  const rows: MyfansSupplyAuditRow[] = [];
  const addAudit = (row: MyfansSupplyAuditRow) => rows.push(row);
  for (const quote of input.sourceRows) appendSourceAuditRows(quote, input, addAudit);
  for (const topic of input.topicRows) appendTopicAuditRows(topic, input, addAudit);
  for (const attempt of input.recoveryHistory) appendRecoveryAuditRow(attempt, input.helpers.qualityGateMinimum, addAudit);
  for (const candidate of input.finalPublishableCandidates) appendSelectedAuditRow(candidate, input.helpers.qualityGateMinimum, addAudit);
  return { version: 1, stages: buildStageSummary(rows), by_slot: buildSlotSummary(input.rotation, rows), rows: rows.slice(0, 5000) };
}
