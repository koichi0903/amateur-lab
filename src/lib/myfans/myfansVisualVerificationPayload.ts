export type VisualVerificationStatus = "verified" | "partial" | "unavailable";
export type VisualRenderStatus = "browser_visible" | "app_only" | "blocked" | "unknown";

export type VisualVerificationAnalysis = {
  scene_summary: string;
  subject_summary: string;
  composition: string;
  standout_moment: string;
  attention_worthy_moment: string;
  color_contrast_cue: string;
  confidence: "high" | "medium" | "low";
  evidence_source: "x_logged_in_chrome_visual";
  frame_or_image_count: number;
  first_frame_cue: string;
  motion_change_cue: string;
  beginning_vs_later: string;
  concrete_observation: string;
  failure_reason: string;
  inspected_url: string;
  media_type: string;
};

export type VisualVerificationSaveInput = {
  id: number;
  status: VisualVerificationStatus;
  reason: string;
  queueJobId: number;
  queueItemId: number;
  claimToken: string;
  visualRenderStatus: VisualRenderStatus;
  analysis: VisualVerificationAnalysis;
};

export type VisualVerificationJobSnapshot = {
  consecutive_gate_failures?: number | null;
  batch_size?: number | null;
  total_sources?: number | null;
  verified_count?: number | null;
  partial_count?: number | null;
  unavailable_count?: number | null;
};

export function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function cleanText(value: unknown, max = 500) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, max);
}

export function statusValue(value: unknown): VisualVerificationStatus {
  const raw = cleanText(value, 40);
  return raw === "verified" || raw === "partial" || raw === "unavailable" ? raw : "partial";
}

export function renderStatusValue(value: unknown): VisualRenderStatus {
  const raw = cleanText(value, 40);
  return raw === "browser_visible" || raw === "app_only" || raw === "blocked" || raw === "unknown" ? raw : "unknown";
}

const firstTruthy = (...values: unknown[]) => values.find(Boolean);

export function buildVisualVerificationSaveInput(
  payload: Record<string, unknown>,
): VisualVerificationSaveInput {
  const evidence = payload.evidence && typeof payload.evidence === "object"
    ? payload.evidence as Record<string, unknown>
    : {};
  const rawConfidence = cleanText(evidence.confidence, 20);
  const confidence = rawConfidence === "high"
    ? "high"
    : rawConfidence === "medium"
      ? "medium"
      : "low";

  const analysis: VisualVerificationAnalysis = {
    scene_summary: cleanText(firstTruthy(evidence.sceneSummary, evidence.scene_summary)),
    subject_summary: cleanText(firstTruthy(evidence.subjectSummary, evidence.subject_summary)),
    composition: cleanText(evidence.composition),
    standout_moment: cleanText(firstTruthy(evidence.standoutMoment, evidence.standout_moment)),
    attention_worthy_moment: cleanText(firstTruthy(evidence.attentionWorthyMoment, evidence.attention_worthy_moment)),
    color_contrast_cue: cleanText(firstTruthy(evidence.colorContrastCue, evidence.color_contrast_cue)),
    confidence,
    evidence_source: "x_logged_in_chrome_visual",
    frame_or_image_count: Math.max(0, Math.round(numberValue(evidence.frameOrImageCount, 0))),
    first_frame_cue: cleanText(firstTruthy(evidence.firstFrameCue, evidence.first_frame_cue)),
    motion_change_cue: cleanText(firstTruthy(evidence.motionChangeCue, evidence.motion_change_cue)),
    beginning_vs_later: cleanText(firstTruthy(evidence.beginningVsLater, evidence.beginning_vs_later)),
    concrete_observation: cleanText(firstTruthy(evidence.concreteObservation, evidence.attentionWorthyMoment, evidence.sceneSummary)),
    failure_reason: cleanText(firstTruthy(evidence.failureReason, payload.reason), 160),
    inspected_url: cleanText(evidence.inspectedUrl, 240),
    media_type: cleanText(evidence.mediaType, 20),
  };

  return {
    id: numberValue(payload.id, 0),
    status: statusValue(payload.status),
    reason: cleanText(firstTruthy(payload.reason, analysis.failure_reason), 160),
    queueJobId: numberValue(payload.queueJobId, 0),
    queueItemId: numberValue(payload.queueItemId, 0),
    claimToken: cleanText(payload.claimToken, 80),
    visualRenderStatus: renderStatusValue(payload.visualRenderStatus),
    analysis,
  };
}

const GATE_REASONS = /sensitive|login|challenge|blocked/i;

type ProgressInput = {
  job: VisualVerificationJobSnapshot | null | undefined;
  count: number | null | undefined;
  status: VisualVerificationStatus;
  reason: string;
};

function getProgressState({ job, count, reason }: ProgressInput) {
  const gateFailures = GATE_REASONS.test(reason)
    ? (job?.consecutive_gate_failures ?? 0) + 1
    : 0;
  const queuePaused = gateFailures >= 2;
  const batchSize = Math.max(1, Number(job?.batch_size ?? 5));
  const batchComplete = !queuePaused && (count ?? 0) > 0 && (count ?? 0) % batchSize === 0;
  const isPaused = queuePaused || batchComplete;
  const isComplete = count === job?.total_sources;
  return { gateFailures, queuePaused, batchSize, batchComplete, isPaused, isComplete };
}

function getProgressCountUpdate(
  job: VisualVerificationJobSnapshot | null | undefined,
  status: VisualVerificationStatus,
) {
  if (status === "verified") return { verified_count: (job?.verified_count ?? 0) + 1 };
  if (status === "partial") return { partial_count: (job?.partial_count ?? 0) + 1 };
  if (status === "unavailable") return { unavailable_count: (job?.unavailable_count ?? 0) + 1 };
  return {};
}

function getPauseUpdate(
  state: ReturnType<typeof getProgressState>,
  now: () => string,
) {
  if (!state.isPaused) return {};
  return {
    paused_at: now(),
    stopped_reason: state.queuePaused
      ? "SENSITIVE_CONTENT_GATE / LOGIN_OR_CHALLENGE が2件連続したため自動pause"
      : `最大${state.batchSize}件の1バッチ完了後に自動pause`,
  };
}

function buildJobProgressUpdate(
  input: ProgressInput,
  state: ReturnType<typeof getProgressState>,
  now: () => string,
) {
  return {
    ...getProgressCountUpdate(input.job, input.status),
    processed_sources: input.count ?? 0,
    consecutive_gate_failures: state.gateFailures,
    status: state.isPaused ? "paused" : state.isComplete ? "completed" : "running",
    ...getPauseUpdate(state, now),
    ...(state.isComplete ? { completed_at: now() } : {}),
    updated_at: now(),
  };
}

export function deriveVisualVerificationProgress(input: ProgressInput & {
  now?: () => string;
}) {
  const now = input.now ?? (() => new Date().toISOString());
  const state = getProgressState(input);
  const jobUpdate = buildJobProgressUpdate(input, state, now);

  return {
    gateFailures: state.gateFailures,
    queuePaused: state.queuePaused,
    batchComplete: state.batchComplete,
    jobUpdate,
  };
}
