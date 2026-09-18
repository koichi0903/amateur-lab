import { primaryUsableVisualFact, type XVisualVideoFacts } from "./xVisualVideoFacts";

export type XSemanticHookCategory =
  | "motion_shift"
  | "brightness_shift"
  | "jacket_video_mismatch"
  | "opening_change"
  | "pacing_change"
  | "visual_contrast"
  | "hidden_find"
  | "actress_focus"
  | "price_reason"
  | "social_proof"
  | "comparison"
  | "dry_observation"
  | "changed_mind"
  | "generic_reaction";

export const SEMANTIC_CATEGORY_QUOTA: Record<XSemanticHookCategory, number> = {
  actress_focus: 2,
  motion_shift: 2,
  brightness_shift: 2,
  jacket_video_mismatch: 2,
  opening_change: 2,
  pacing_change: 2,
  visual_contrast: 2,
  hidden_find: 2,
  dry_observation: 2,
  changed_mind: 2,
  social_proof: 2,
  price_reason: 2,
  comparison: 2,
  generic_reaction: 1,
};

type SemanticItem = {
  sourceType: string;
  actress: string | null;
  visualFacts?: XVisualVideoFacts | null;
};

type SemanticVariant = {
  hookDirection: string;
  bodyText: string;
};

export type XSemanticAssignment = {
  category: XSemanticHookCategory;
  fact: ReturnType<typeof primaryUsableVisualFact>;
  reason: string;
};

export function assignSemanticHook(item: SemanticItem, variant: SemanticVariant): XSemanticAssignment {
  const facts = item.visualFacts?.usableFacts ?? [];
  const first = (test: (fact: NonNullable<typeof facts[number]>) => boolean) => facts.find(test) ?? null;
  const selected = [
    { category: "jacket_video_mismatch" as const, fact: first((fact) => fact.kind === "jacket_sample_mismatch"), reason: "ジャケットと動画の双方で差分Factを確認" },
    { category: "brightness_shift" as const, fact: first((fact) => fact.kind === "brightness"), reason: "動画フレーム間の明るさ差を確認" },
    { category: "opening_change" as const, fact: first((fact) => fact.kind === "first_visual_change_sec" || (fact.kind === "notable_video_hook" && fact.value === "opening_change")), reason: "冒頭から最初の有意な画面変化を確認" },
    { category: "pacing_change" as const, fact: first((fact) => fact.kind === "pacing"), reason: "フレーム変化の回数から切替ペースを確認" },
    { category: "motion_shift" as const, fact: first((fact) => fact.kind === "motion_level" || fact.kind === "mood_shift_detected" || (fact.kind === "notable_video_hook" && fact.value === "first_seconds_attention")), reason: "動画内の動きの強さを確認" },
    { category: "visual_contrast" as const, fact: first((fact) => fact.kind === "visual_style" && fact.value === "color_contrast"), reason: "明るさ差ではない色味の変化を確認" },
  ].find((candidate) => candidate.fact);
  if (selected) return selected;
  if (item.sourceType === "COMPARISON") return { category: "comparison", fact: null, reason: "比較ソース由来" };
  if (item.sourceType === "PRICE_EVENT" || item.sourceType === "MONEY") return { category: "price_reason", fact: null, reason: "価格イベント/MONEYソース由来" };
  if (item.sourceType === "ACTRESS_TREND") return { category: "actress_focus", fact: null, reason: "女優トレンドソース由来" };
  if (variant.hookDirection === "social_proof") return { category: "social_proof", fact: null, reason: "レビュー/評価Hook由来" };
  if (variant.hookDirection === "hot_take") return { category: "changed_mind", fact: null, reason: "判断変化を表すHook由来" };
  if (variant.hookDirection === "comparison" || variant.hookDirection === "pattern_break") return { category: "dry_observation", fact: null, reason: "比較/パターン観察Hook由来" };
  if (item.sourceType === "HIDDEN_GEM" || variant.hookDirection === "missed" || variant.hookDirection === "curiosity") return { category: "hidden_find", fact: null, reason: "見落とし/発見Hook由来" };
  if (/雰囲気|空気|気になる|引っかか|見落とし/.test(variant.bodyText)) return { category: "generic_reaction", fact: null, reason: "抽象的な反応本文へfallback" };
  return { category: "dry_observation", fact: null, reason: "確定Factなし。本文の具体的な観察へfallback" };
}

export function semanticHookCategory(item: SemanticItem, variant: SemanticVariant): XSemanticHookCategory {
  return assignSemanticHook(item, variant).category;
}
