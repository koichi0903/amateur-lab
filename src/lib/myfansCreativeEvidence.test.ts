import assert from "node:assert/strict";
import { humanObservationFromEvidence, visualAnalysisForQuote, visualUnderstandingFor } from "./myfansCreativeEvidence";
import type { MyfansQuoteCandidate } from "./myfansAnalytics";
import type { PublicCopyFacts } from "./myfansXExecution";

const quote = {
  id: 55,
  x_post_url: "https://x.com/creator/status/55",
  media_permalink: "https://x.com/creator/status/55/video/1",
  media_type: "video",
  quote_visual_ready: true,
  visual_render_status: "browser_visible",
  visual_analysis_status: "verified",
  visual_analyzer_version: "fixture-v1",
  media_count: 1,
  visual_analysis_json: {
    concrete_observation: "白い部屋で動画の冒頭に表情が変わる",
    concreteObservation: "優先度の低い別表記",
    evidence_source: "frame:0",
    confidence: "high",
    frame_or_image_count: 3,
    scene_summary: "白い部屋の動画",
    subject_summary: "人物の表情",
    composition: "近め",
    visible_change_or_contrast: "冒頭から表情が変わる",
    motion_cue: "冒頭に動きがある",
    standout_moment: "表情の変化",
  },
} as unknown as MyfansQuoteCandidate;

const analysis = visualAnalysisForQuote(quote);
assert.ok(analysis);
assert.equal(analysis.status, "verified");
assert.equal(analysis.concreteObservation, "白い部屋で動画の冒頭に表情が変わる");
assert.equal(analysis.evidenceSource, "frame:0");
assert.equal(analysis.frameOrImageCount, 3);
assert.equal(analysis.analyzerVersion, "fixture-v1");
assert.equal(humanObservationFromEvidence(analysis, "video", 0), "白っぽい部屋で動き出すところが先に目に入る");
assert.equal(humanObservationFromEvidence(analysis, "video", 1), "部屋の明るさと動き出しで、最初の数秒が軽く見える");

const understanding = visualUnderstandingFor({
  sourceText: "",
  productFacts: { title: "sample", genre: "" },
  visualContext: "video",
  quoteVisualAnalysis: analysis,
} as unknown as PublicCopyFacts);
assert.equal(understanding.visualAnalysisStatus, "verified");
assert.equal(understanding.attentionMoment, "表情や目線で雰囲気が先に出る");
assert.equal(understanding.humanObservation, "白っぽい部屋で動き出すところが先に目に入る");
assert.equal(understanding.uncertaintyLevel, "low");

console.log("myfans Creative Evidence tests passed");
