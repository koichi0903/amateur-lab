import assert from "node:assert/strict";
import { validateXCopyGrammar } from "@/lib/xCreativeEngine";
import { assignSemanticHook, semanticHookCategory } from "./xGrowthSemantic";
import { buildVisualVideoFacts } from "@/lib/xVisualVideoFacts";

assert.equal(validateXCopyGrammar({ sourceType: "WORK" }, "AI生成作品 の一本、気になります。").passed, false);
assert.equal(validateXCopyGrammar({ sourceType: "WORK" }, "同じ30%OFFでも、差があります。").passed, false);
assert.equal(validateXCopyGrammar({ sourceType: "COMPARISON" }, "同じ30%OFFでも、差があります。\nこちらから見たいです。").passed, true);

const facts = buildVisualVideoFacts({ sampleMovieUrl: "https://example.test/movie.mp4", manualTags: ["first_seconds_strong"] });
const noFacts = buildVisualVideoFacts({});
assert.equal(semanticHookCategory({ sourceType: "WORK", actress: "神宮寺ナオ", visualFacts: facts }, { hookDirection: "curiosity", bodyText: facts.usableFacts[0]?.safePhrase ?? "" }), "motion_shift");
assert.equal(semanticHookCategory({ sourceType: "WORK", actress: "神宮寺ナオ", visualFacts: noFacts }, { hookDirection: "curiosity", bodyText: "神宮寺ナオが気になる" }), "hidden_find");
assert.equal(semanticHookCategory({ sourceType: "ACTRESS_TREND", actress: "神宮寺ナオ", visualFacts: noFacts }, { hookDirection: "curiosity", bodyText: "神宮寺ナオの見方が変わる" }), "actress_focus");
assert.equal(semanticHookCategory({ sourceType: "PRICE_EVENT", actress: null, visualFacts: facts }, { hookDirection: "curiosity", bodyText: "価格が気になる" }), "motion_shift");
const openingFacts = buildVisualVideoFacts({ sampleMovieUrl: "https://example.test/movie.mp4", videoEvidence: [
  { kind: "first_visual_change_sec", value: 3, confidence: 0.9, safePhrase: "冒頭3.0秒付近で画面が変わる。" },
  { kind: "pacing", value: "fast", confidence: 0.9, safePhrase: "切り替わりが早め。" },
] });
assert.equal(assignSemanticHook({ sourceType: "WORK", actress: null, visualFacts: openingFacts }, { hookDirection: "curiosity", bodyText: "冒頭の変化が気になる" }).category, "opening_change");
const pacingFacts = buildVisualVideoFacts({ sampleMovieUrl: "https://example.test/movie.mp4", videoEvidence: [
  { kind: "pacing", value: "fast", confidence: 0.9, safePhrase: "切り替わりが早め。" },
] });
assert.equal(assignSemanticHook({ sourceType: "WORK", actress: null, visualFacts: pacingFacts }, { hookDirection: "curiosity", bodyText: "切り替わりが早め" }).category, "pacing_change");
const mismatchFacts = buildVisualVideoFacts({ sampleMovieUrl: "https://example.test/movie.mp4", jacketEvidence: [
  { kind: "jacket_sample_mismatch", value: true, confidence: 0.9, safePhrase: "ジャケと動画で明るさと色味が違う。" },
], videoEvidence: [
  { kind: "jacket_sample_mismatch", value: true, confidence: 0.9, safePhrase: "ジャケと動画で明るさと色味が違う。" },
] });
assert.equal(assignSemanticHook({ sourceType: "WORK", actress: null, visualFacts: mismatchFacts }, { hookDirection: "curiosity", bodyText: "ジャケと動画で見え方が違う" }).category, "jacket_video_mismatch");

const fallbackCases = [
  { sourceType: "COMPARISON", hookDirection: "social_proof", bodyText: "レビューが気になる", category: "comparison", reason: "比較ソース由来" },
  { sourceType: "PRICE_EVENT", hookDirection: "plain", bodyText: "価格", category: "price_reason", reason: "価格イベント/MONEYソース由来" },
  { sourceType: "MONEY", hookDirection: "plain", bodyText: "価格", category: "price_reason", reason: "価格イベント/MONEYソース由来" },
  { sourceType: "ACTRESS_TREND", hookDirection: "plain", bodyText: "女優", category: "actress_focus", reason: "女優トレンドソース由来" },
  { sourceType: "WORK", hookDirection: "social_proof", bodyText: "レビュー", category: "social_proof", reason: "レビュー/評価Hook由来" },
  { sourceType: "WORK", hookDirection: "hot_take", bodyText: "判断", category: "changed_mind", reason: "判断変化を表すHook由来" },
  { sourceType: "WORK", hookDirection: "comparison", bodyText: "観察", category: "dry_observation", reason: "比較/パターン観察Hook由来" },
  { sourceType: "WORK", hookDirection: "pattern_break", bodyText: "観察", category: "dry_observation", reason: "比較/パターン観察Hook由来" },
  { sourceType: "HIDDEN_GEM", hookDirection: "plain", bodyText: "発見", category: "hidden_find", reason: "見落とし/発見Hook由来" },
  { sourceType: "WORK", hookDirection: "missed", bodyText: "発見", category: "hidden_find", reason: "見落とし/発見Hook由来" },
  { sourceType: "WORK", hookDirection: "curiosity", bodyText: "発見", category: "hidden_find", reason: "見落とし/発見Hook由来" },
  { sourceType: "WORK", hookDirection: "plain", bodyText: "雰囲気が気になる", category: "generic_reaction", reason: "抽象的な反応本文へfallback" },
  { sourceType: "WORK", hookDirection: "plain", bodyText: "具体的な観察", category: "dry_observation", reason: "確定Factなし。本文の具体的な観察へfallback" },
] as const;

for (const fallbackCase of fallbackCases) {
  assert.deepEqual(
    assignSemanticHook(
      { sourceType: fallbackCase.sourceType, actress: null, visualFacts: noFacts },
      { hookDirection: fallbackCase.hookDirection, bodyText: fallbackCase.bodyText },
    ),
    { category: fallbackCase.category, fact: null, reason: fallbackCase.reason },
  );
}

console.log("xGrowthSemanticDiversity tests passed");
