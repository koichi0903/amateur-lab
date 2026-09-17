export type XFactSource = "jacket" | "sample_image" | "sample_video" | "metadata" | "manual_tag";

export type XVisualFactKind =
  | "brightness"
  | "framing"
  | "setting"
  | "visual_style"
  | "costume_category"
  | "image_focus"
  | "jacket_sample_mismatch"
  | "person_appears_early"
  | "title_card_duration_sec"
  | "first_visual_change_sec"
  | "motion_level"
  | "pacing"
  | "opening_strength"
  | "mood_shift_detected"
  | "notable_visual_hook"
  | "notable_video_hook";

export type XVisualFactValue = string | number | boolean;

export type XVisualFact = {
  kind: XVisualFactKind;
  value: XVisualFactValue;
  confidence: number;
  source: XFactSource;
  evidenceTimeSec?: number;
  safePhrase?: string;
};

export type XVisualVideoFacts = {
  version: "visual-video-facts-v1";
  generatedAt: string;
  facts: XVisualFact[];
  usableFacts: XVisualFact[];
  diagnostics: string[];
};

export type XVisualFactInput = {
  imageUrl?: string | null;
  sampleMovieUrl?: string | null;
  manualTags?: string[] | null;
  mediaQuality?: string | null;
  /** Set only when a real frame probe has been run. */
  videoEvidence?: Array<{ kind: XVisualFactKind; value: XVisualFactValue; confidence: number; timeSec?: number; safePhrase?: string }>;
  jacketEvidence?: Array<{ kind: XVisualFactKind; value: XVisualFactValue; confidence: number; timeSec?: number; safePhrase?: string }>;
};

const SUPPORTED_VIDEO_HOOKS = new Set(["first_seconds_attention", "opening_change", "calm_opening", "safe_preview"]);
const UNSUPPORTED_CLAIM_WORDS = /笑|表情|かわい|エロ|性|行為|裸|胸|尻|誘惑|美人/;

function fact(input: Omit<XVisualFact, "confidence"> & { confidence?: number }): XVisualFact {
  return { ...input, confidence: input.confidence ?? 0.95 };
}

/**
 * Converts already-confirmed FANZA media metadata/manual tags into bounded facts.
 * It deliberately does not infer image content from an URL. Frame-derived facts
 * can be supplied later through videoEvidence without changing the guard.
 */
export function buildVisualVideoFacts(input: XVisualFactInput, generatedAt = new Date().toISOString()): XVisualVideoFacts {
  const facts: XVisualFact[] = [];
  const tags = new Set(input.manualTags ?? []);
  if (input.imageUrl) facts.push(fact({ kind: "image_focus", value: "unknown", source: "metadata", confidence: 0 }));
  if (input.sampleMovieUrl) facts.push(fact({ kind: "notable_video_hook", value: "sample_available", source: "metadata", confidence: 0 }));

  if (tags.has("first_seconds_strong")) {
    facts.push(fact({ kind: "notable_video_hook", value: "first_seconds_attention", source: "manual_tag", safePhrase: "開いてすぐ、画面の変化に目が止まる。" }));
  }
  if (tags.has("scene_surprise")) {
    facts.push(fact({ kind: "notable_video_hook", value: "opening_change", source: "manual_tag", safePhrase: "冒頭の展開が予想と少し違う。" }));
  }
  if (tags.has("safe_preview")) {
    facts.push(fact({ kind: "notable_video_hook", value: "safe_preview", source: "manual_tag", safePhrase: "サンプルの冒頭だけでも確認できる。" }));
  }
  if (tags.has("actress_fit")) {
    facts.push(fact({ kind: "notable_video_hook", value: "actress_fit", source: "manual_tag", safePhrase: "この動画では、いつもと見え方が少し違う。" }));
  }
  if (tags.has("visual_mismatch")) {
    // A single tag is not dual evidence. Keep it as a rejected candidate.
    facts.push(fact({ kind: "jacket_sample_mismatch", value: true, source: "manual_tag", safePhrase: "ジャケとサンプルで見え方が違う。" }));
  }

  for (const evidence of input.videoEvidence ?? []) {
    facts.push(fact({
      kind: evidence.kind,
      value: evidence.value,
      source: "sample_video",
      confidence: evidence.confidence,
      evidenceTimeSec: evidence.timeSec,
      safePhrase: evidence.safePhrase,
    }));
  }
  for (const evidence of input.jacketEvidence ?? []) {
    facts.push(fact({ kind: evidence.kind, value: evidence.value, source: "jacket", confidence: evidence.confidence, evidenceTimeSec: evidence.timeSec, safePhrase: evidence.safePhrase }));
  }

  const hasDualMismatchEvidence = facts.some((candidate) => candidate.kind === "jacket_sample_mismatch" && (candidate.source === "jacket" || candidate.source === "sample_image"))
    && facts.some((candidate) => candidate.kind === "jacket_sample_mismatch" && candidate.source === "sample_video");
  const usableFacts = facts.filter((candidate) => candidate.kind === "jacket_sample_mismatch"
    ? hasDualMismatchEvidence && isUsableVisualFact({ ...candidate, kind: "visual_style", value: "jacket_video_mismatch" })
    : isUsableVisualFact(candidate));
  const diagnostics = facts.length === 0
    ? ["画像/動画の確定Factなし。メタデータfallbackを使用"]
    : usableFacts.length < 1
      ? ["Fact候補はあるがTruth Guardを通過したFactなし"]
      : [];
  return { version: "visual-video-facts-v1", generatedAt, facts, usableFacts, diagnostics };
}

export function isUsableVisualFact(candidate: XVisualFact): boolean {
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0.75) return false;
  if (candidate.safePhrase && UNSUPPORTED_CLAIM_WORDS.test(candidate.safePhrase)) return false;
  if (candidate.kind === "jacket_sample_mismatch") {
    return false;
  }
  if (candidate.kind === "opening_strength" && candidate.source !== "sample_video") return false;
  if (candidate.kind === "mood_shift_detected" && candidate.source !== "sample_video") return false;
  if (candidate.kind === "notable_video_hook" && typeof candidate.value === "string" && !SUPPORTED_VIDEO_HOOKS.has(candidate.value) && candidate.value !== "actress_fit") return false;
  if (["brightness", "framing", "setting", "visual_style", "costume_category"].includes(candidate.kind) && candidate.source === "metadata") return false;
  return Boolean(candidate.safePhrase || ["brightness", "framing", "setting", "visual_style", "costume_category", "motion_level", "pacing"].includes(candidate.kind));
}

export function primaryUsableVisualFact(facts: XVisualVideoFacts | null | undefined) {
  return facts?.usableFacts.find((candidate) => candidate.kind === "notable_video_hook")
    ?? facts?.usableFacts.find((candidate) => candidate.kind === "jacket_sample_mismatch")
    ?? facts?.usableFacts[0]
    ?? null;
}

export function visualFactBasis(facts: XVisualVideoFacts | null | undefined) {
  const primary = primaryUsableVisualFact(facts);
  if (!primary) return { label: "メタデータfallback", source: "metadata" as const };
  if (primary.kind === "jacket_sample_mismatch") return { label: "ジャケ×サンプル差", source: primary.source };
  if (primary.source === "sample_video" || primary.source === "manual_tag") return { label: "動画", source: primary.source };
  if (primary.source === "jacket" || primary.source === "sample_image") return { label: "画像", source: primary.source };
  return { label: "視覚Fact", source: primary.source };
}

export function visualFactScores(facts: XVisualVideoFacts | null | undefined) {
  const usable = facts?.usableFacts ?? [];
  const maxConfidence = usable.reduce((max, candidate) => Math.max(max, candidate.confidence), 0);
  return {
    visualSpecificity: usable.some((candidate) => candidate.source === "jacket" || candidate.source === "sample_image") ? 90 : 0,
    videoHookStrength: usable.some((candidate) => candidate.kind === "notable_video_hook") ? 88 : 0,
    mismatchStrength: usable.some((candidate) => candidate.kind === "jacket_sample_mismatch") ? 92 : 0,
    factConfidence: Math.round(maxConfidence * 100),
    mediaTextFit: usable.length ? 82 : 48,
  };
}
