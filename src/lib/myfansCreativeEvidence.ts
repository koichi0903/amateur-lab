import type { AttentionValue, CopySearchAngle, DailyRole, HumanReactionType, PublicCopyFacts, QuoteVisualAnalysis, VisualUnderstanding } from "./myfansXExecution";
import type { MyfansReasonToCare } from "./myfansQuotePool";
import type { MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { machineLikeCopyIssue } from "@/lib/myfansPublicCopyRules";

export const MYFANS_VISUAL_ANALYZER_VERSION = "visual-understanding-v3-logged-in-chrome";

export function visualRenderStatus(candidate: MyfansQuoteCandidate | null | undefined) {
  if (!candidate) return "unknown" as const;
  if (candidate.visual_render_status) return candidate.visual_render_status;
  const status = candidate.media_permalink_validation_status ?? "";
  if (candidate.media_type === "video" && /verified_video_permalink/.test(status)) return "browser_visible" as const;
  if (candidate.media_type === "image" && candidate.quote_visual_ready && candidate.media_permalink) return "browser_visible" as const;
  if (/not_rendered/i.test(status)) return "app_only" as const;
  if (/blocked|sensitive|timeout|no_result/i.test(status)) return "blocked" as const;
  return "unknown" as const;
}

export function hasBrowserVisibleVisual(candidate: MyfansQuoteCandidate | null | undefined) {
  return Boolean(candidate?.quote_visual_ready && candidate.media_permalink && visualRenderStatus(candidate) === "browser_visible" && (candidate.media_type === "image" || candidate.media_type === "video"));
}

export function hasVerifiedVisualAnalysis(candidate: MyfansQuoteCandidate | null | undefined) {
  return visualAnalysisForQuote(candidate ?? null)?.status === "verified";
}

export function quoteInsight(quote: MyfansQuoteCandidate | null) {
  if (!quote) return "";
  const metrics = [
    quote.views ? `表示${quote.views.toLocaleString("ja-JP")}` : "",
    quote.likes ? `いいね${quote.likes.toLocaleString("ja-JP")}` : "",
    quote.reposts ? `RP${quote.reposts.toLocaleString("ja-JP")}` : "",
  ].filter(Boolean);
  return metrics.length ? metrics.slice(0, 2).join(" / ") : "元投稿の反応を確認済み";
}

export function compactSourceText(text: string, max = 34) {
  return text.replace(/\s+/g, " ").replace(/https?:\/\/\S+/g, "").trim().slice(0, max);
}

export function completeSourcePhrase(text: string, max = 34) {
  const normalized = text.replace(/\s+/g, " ").replace(/https?:\/\/\S+/g, "").trim();
  if (normalized.length <= max) return normalized;
  const firstSentence = normalized.match(/^.{6,80}?[。！？!?]/u)?.[0] ?? "";
  return firstSentence.length <= max ? firstSentence : "";
}

export function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstStringField(...values: unknown[]) {
  for (const value of values) {
    const field = stringField(value);
    if (field) return field;
  }
  return "";
}

function visualAnalysisConfidence(raw: Record<string, unknown>, status: string) {
  const confidence = stringField(raw.confidence);
  if (confidence === "high" || confidence === "medium") return confidence;
  return status === "verified" ? "medium" : "low";
}

function visualAnalysisMediaType(quote: MyfansQuoteCandidate) {
  if (quote.media_type === "video") return "video" as const;
  if (quote.media_type === "image") return "image" as const;
  return "public_post" as const;
}

function visualAnalysisFrameCount(raw: Record<string, unknown>, quote: MyfansQuoteCandidate, mediaType: string) {
  if (typeof raw.frame_or_image_count === "number") return raw.frame_or_image_count;
  return quote.media_count ?? (mediaType === "text_only" ? 0 : 1);
}

function normalizeVisualEvidence(text: string) {
  return text.replace(/\s+/g, " ").replace(/[「」『』]/g, "").trim();
}

function addRoomAndBearObservationOptions(raw: string, options: string[]) {
  if (/白|室内|部屋/.test(raw) && /踊|動き|動画|冒頭/.test(raw)) {
    options.push("白っぽい部屋で動き出すところが先に目に入る");
    options.push("部屋の明るさと動き出しで、最初の数秒が軽く見える");
  }
  if (/くま|熊|クマ|bear/i.test(raw)) options.push("くまっぽい小物が入っていて、画面が少しゆるく見える");
}

function addBedAndBeachObservationOptions(raw: string, options: string[]) {
  if (/ベッド|向かい合|手前|距離/.test(raw)) {
    options.push("白いベッド越しの距離感が近くて、場面がすぐ分かる");
    options.push("手前に人が入るだけで、向かい合っている近さが出る");
  }
  if (/砂浜|海|夏/.test(raw) && /赤|黒/.test(raw)) {
    options.push("砂浜の明るさに赤と黒がぱっと浮いて見える");
    options.push("海辺の明るい画面で、赤と黒の色だけ先に残る");
  }
}

function addDistanceAndBodyObservationOptions(raw: string, options: string[]) {
  if (/引き|近|寄り|画角|フレーミング|切り替わ|距離感が近く/.test(raw)) {
    options.push("引きで見せてから少し近くなるので、そこで目が戻る");
    options.push("最初は引きなのに、途中で距離が詰まるのが分かる");
  }
  if (/全身/.test(raw)) options.push("全身が見える切り取りで、好みかどうかが早い");
}

function addProfileObservationOptions(raw: string, options: string[]) {
  if (/制服|階段|プロフィール|白いプロフィール/.test(raw)) {
    options.push("階段の写真から白いプロフィール画面に切り替わるのが目に残る");
    options.push("制服っぽい写真のあとにプロフィール画面が出て、流れが分かりやすい");
  }
}

function humanObservationOptions(raw: string) {
  const options: string[] = [];
  addRoomAndBearObservationOptions(raw, options);
  addBedAndBeachObservationOptions(raw, options);
  addDistanceAndBodyObservationOptions(raw, options);
  addProfileObservationOptions(raw, options);
  return options;
}

function addFallbackHumanObservationOptions(raw: string, mediaType: PublicCopyFacts["visualContext"], options: string[]) {
  if (!options.length && /冒頭|最初|動画|motion|動き/i.test(raw)) options.push("冒頭の動きだけで、流すか見るかが決まる");
  if (!options.length && mediaType === "image") options.push("色と距離感が先に入ってくる一枚");
  if (!options.length && mediaType === "video") options.push("最初の数秒で見せ方が分かる動画");
}

export function humanObservationFromEvidence(analysis: QuoteVisualAnalysis | null, mediaType: PublicCopyFacts["visualContext"], variant = 0) {
  const raw = humanObservationEvidenceText(analysis);
  if (!hasVerifiedHumanObservation(analysis, raw)) return "";
  const options = humanObservationOptions(raw);
  addFallbackHumanObservationOptions(raw, mediaType, options);
  return options[variant % options.length] ?? "";
}

function humanObservationEvidenceText(analysis: QuoteVisualAnalysis | null) {
  return normalizeVisualEvidence([
    analysis?.concreteObservation,
    analysis?.standoutMoment,
    analysis?.sceneSummary,
    analysis?.composition,
    analysis?.cameraDistanceOrFraming,
    analysis?.visibleChangeOrContrast,
    analysis?.motionCue,
  ].filter(Boolean).join(" / "));
}

function hasVerifiedHumanObservation(analysis: QuoteVisualAnalysis | null, raw: string) {
  return Boolean(analysis && analysis.status === "verified" && raw.length >= 5);
}

export function weakAttentionCue(text: string) {
  return /白いプロフィール|プロフィール画面|白っぽい部屋で動き出す|白い画面|単なる背景|背景色|室内の縦動画|縦動画だけ|室内で動く|部屋で動き出す|目に入るだけ|目に残るだけ|手が止まるだけ/.test(text);
}

function addAttentionSceneOptions(raw: string, options: string[]) {
  if (/制服/.test(raw) && /階段/.test(raw)) options.push("制服っぽい写真から入る");
  if (/赤|黒/.test(raw) && /砂浜|海|夏/.test(raw)) options.push("海辺で赤と黒だけぱっと浮く");
  if (/青/.test(raw) && /ランジェリー/.test(raw)) options.push("白いベッドに青いランジェリーが出る");
  if (/ベッド/.test(raw) && /距離|向かい合|手前|近/.test(raw)) options.push("ベッド越しの距離が近い");
  if (/くま|熊|クマ|bear/i.test(raw) && /踊|動き|冒頭/.test(raw)) options.push("くまっぽい小物と踊り出しのゆるさ");
}

function addAttentionPersonOptions(raw: string, mediaType: PublicCopyFacts["visualContext"], options: string[]) {
  if (/引き/.test(raw) && /近|距離が近|寄り|上半身/.test(raw)) options.push("引きから近めに変わる");
  if (/全身/.test(raw)) options.push("全身で好みがすぐ分かる");
  if (/表情|顔|目線/.test(raw)) options.push("表情や目線で雰囲気が先に出る");
  if (/衣装|服装|ランジェリー|水着|ボトムス/.test(raw)) options.push("服装の色と見せ方がはっきりしている");
  if (/動き|踊|motion|冒頭|途中|切り替わ/.test(raw)) options.push(mediaType === "video" ? "途中で見え方が変わる" : "最初の切り取りで雰囲気が決まる");
}

function attentionWorthyMomentFromEvidence(analysis: QuoteVisualAnalysis | null, mediaType: PublicCopyFacts["visualContext"], variant = 0) {
  if (!analysis || analysis.status !== "verified") return "";
  const raw = normalizeVisualEvidence([
    analysis.subjectSummary,
    analysis.concreteObservation,
    analysis.standoutMoment,
    analysis.facialExpressionOrPoseCue,
    analysis.visibleChangeOrContrast,
    analysis.beginningVsLaterChange,
    analysis.motionCue,
    analysis.composition,
    analysis.cameraDistanceOrFraming,
    analysis.sceneSummary,
  ].filter(Boolean).join(" / "));
  const options: string[] = [];
  addAttentionSceneOptions(raw, options);
  addAttentionPersonOptions(raw, mediaType, options);
  const strong = options.filter((item) => !weakAttentionCue(item));
  return (strong[variant % Math.max(1, strong.length)] ?? "").trim();
}

export function attentionValueForText(text: string, moment = ""): AttentionValue {
  const joined = `${text} ${moment}`;
  const weakCue = weakAttentionCue(joined);
  const curiosity = /何それ|見たい|気になる|どうなる|変わる|ギャップ|ゆるさ|近い|ぱっと浮く/.test(joined) ? 27 : /強い|残る|止まる/.test(joined) ? 18 : 10;
  const emotionalPull = /ずるい|好き|そりゃ|刺さる|見ちゃう|軽く見えない|戻る|ゆるさ|近い|近め|距離|変わる|ギャップ/.test(joined) ? 22 : /気になる|強い|納得/.test(joined) ? 17 : 8;
  const visualSpecificity = /制服|階段|赤|黒|砂浜|海辺|ベッド|距離|くま|踊|引き|近め|全身|表情|目線|衣装|服装|色|ポーズ|切り替わ|途中/.test(joined) ? 20 : 8;
  const broadComprehensibility = /visual|cue|構図|画角|プロフィール画面|白っぽい部屋/.test(joined) ? 7 : 14;
  const naturalReaction = machineLikeCopyIssue(text) ? 3 : /です。|ます。/.test(text) ? 7 : 10;
  const score = Math.max(0, Math.min(100, curiosity + emotionalPull + visualSpecificity + broadComprehensibility + naturalReaction - (weakCue ? 24 : 0)));
  return {
    score,
    curiosity,
    emotionalPull,
    visualSpecificity,
    broadComprehensibility,
    naturalReaction,
    reasons: [
      weakCue ? "低Attention cueをhookにしています" : "見たい理由になるvisual momentがあります",
      `curiosity ${curiosity}/30`,
      `emotional ${emotionalPull}/25`,
      `specificity ${visualSpecificity}/20`,
    ],
    weakCue,
  };
}

export function visualAnalysisForQuote(quote: MyfansQuoteCandidate | null): QuoteVisualAnalysis | null {
  if (!quote) return null;
  const raw = quote.visual_analysis_json && typeof quote.visual_analysis_json === "object" ? quote.visual_analysis_json : {};
  const status = quote.visual_analysis_status === "verified" || quote.visual_analysis_status === "partial" ? quote.visual_analysis_status : "unavailable";
  const concreteObservation = firstStringField(raw.concrete_observation, raw.concreteObservation, raw.attention_worthy_moment, raw.standout_moment, raw.standoutMoment);
  const evidenceSource = firstStringField(raw.evidence_source, raw.evidenceSource, quote.media_permalink, quote.x_post_url);
  const confidence = visualAnalysisConfidence(raw, status);
  const mediaType = visualAnalysisMediaType(quote);
  const verifiedEnough = status === "verified" && concreteObservation.length >= 5 && evidenceSource.length > 0 && hasBrowserVisibleVisual(quote);
  return {
    status: verifiedEnough ? "verified" : status === "partial" ? "partial" : "unavailable",
    mediaType,
    frameOrImageCount: visualAnalysisFrameCount(raw, quote, mediaType),
    sceneSummary: firstStringField(raw.scene_summary, raw.sceneSummary),
    subjectSummary: firstStringField(raw.subject_summary, raw.subjectSummary),
    composition: stringField(raw.composition),
    facialExpressionOrPoseCue: firstStringField(raw.facial_expression_or_pose_cue, raw.facialExpressionOrPoseCue),
    cameraDistanceOrFraming: firstStringField(raw.camera_distance_or_framing, raw.camera_distance, raw.framing),
    visibleChangeOrContrast: firstStringField(raw.visible_change_or_contrast, raw.visible_change, raw.beginning_vs_later, raw.beginning_vs_later_change),
    textOverlayCue: firstStringField(raw.text_overlay_cue, raw.caption_cue),
    motionCue: firstStringField(raw.motion_cue, raw.motion_change_cue),
    beginningVsLaterChange: firstStringField(raw.beginning_vs_later_change, raw.beginningVsLaterChange, raw.beginning_vs_later),
    standoutMoment: firstStringField(raw.standout_moment, raw.standoutMoment, raw.attention_worthy_moment),
    concreteObservation,
    confidence,
    evidenceSource,
    analyzerVersion: quote.visual_analyzer_version || MYFANS_VISUAL_ANALYZER_VERSION,
  };
}

function sourceVisualCue(source: string) {
  const text = source.replace(/[「」『』]/g, "");
  const patterns = [
    /最初[^。！？!?]{0,18}(一枚|1枚|冒頭|印象|雰囲気|変わる)/,
    /(1枚目|一枚目)[^。！？!?]{0,18}(2枚目|二枚目|違う|変わる)/,
    /(冒頭|テロップ|字幕)[^。！？!?]{0,22}(分かる|見える|入る|変わる)/,
    /(表情|衣装|制服|顔|距離|アップ|引き)[^。！？!?]{0,18}(変わる|目に入る|近い|違う)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[0]?.trim();
    if (match && match.length >= 5) return match;
  }
  return "";
}

function productVisualCue(productSource: string) {
  const cues: Array<[RegExp, string]> = [
    [/顔出し|完全顔|素顔/, "顔出しの雰囲気"],
    [/透明感|清楚|美人|港区|女子大|jd|ol/, "人物の雰囲気"],
    [/巨乳|cup|カップ|爆乳|胸|乳/, "体型の分かりやすさ"],
    [/人妻|熟女|夫婦|妻|ママ/, "生活感のある設定"],
    [/主観|ハメ撮り|個人|素人|vlog|自撮り/, "作り込みすぎない近さ"],
    [/制服|コスプレ|衣装|ランジェリー/, "衣装の方向性"],
    [/一枚|1枚|画像|写真|サムネ/, "1枚目の切り取り"],
    [/動画|ムービー|映像|冒頭/, "冒頭の動き"],
  ];
  return cues.find(([pattern]) => pattern.test(productSource))?.[1] ?? "";
}

function visualMomentForContext(mediaType: PublicCopyFacts["visualContext"], concreteCue: string, source: string) {
  if (mediaType === "video") return concreteCue || "冒頭の数秒で雰囲気が伝わる";
  if (mediaType === "image") return concreteCue || "最初の1枚で雰囲気が伝わる";
  return source ? "元投稿本文の入りで場面を想像できる" : "視覚情報は未確認";
}

function firstImpressionCueForContext(mediaType: PublicCopyFacts["visualContext"], source: string) {
  if (mediaType === "video") return "動き出しで続きを見たくなる";
  if (mediaType === "image") return "流れてきた瞬間に止まる";
  return source ? "言い出しで気になる" : "数字以外の手がかりが薄い";
}

function contrastGapForContext(source: string, productSource: string) {
  if (/最初|途中|あと|ギャップ|急|変わ/.test(source)) return "最初と後半で印象が変わる";
  if (/素人|個人|主観|vlog|日常|彼女|顔/.test(productSource)) return "作り込みすぎない近さが強みになりやすい";
  return "ひと目で好みが分かれる";
}

function visualCueForContext(productSource: string, concreteVisualCue: string) {
  if (/顔|透明感|港区|女子大|jd|ol/.test(productSource)) return "人物の雰囲気が入口になる";
  if (/巨乳|cup|カップ|爆乳|胸|乳/.test(productSource)) return "分かりやすい見た目の強さが入口になる";
  if (/人妻|熟女|夫婦|妻|ママ/.test(productSource)) return "生活感や距離感が入口になる";
  return concreteVisualCue || "見た瞬間の分かりやすさが入口になる";
}

function visualUnderstandingEvidenceFor(facts: PublicCopyFacts) {
  const source = compactSourceText(facts.sourceText, 48);
  const productText = `${facts.productFacts.title} ${facts.productFacts.genre}`;
  const productSource = productText.toLowerCase();
  const mediaType = facts.visualContext;
  const concreteCueFromSource = sourceVisualCue(source);
  const concreteCueFromProduct = productVisualCue(productSource);
  const verified = facts.quoteVisualAnalysis?.status === "verified" ? facts.quoteVisualAnalysis : null;
  const concreteVisualCue = verified?.concreteObservation || concreteCueFromSource || concreteCueFromProduct;
  const attentionMoment = attentionWorthyMomentFromEvidence(verified, mediaType);
  const rawVisualEvidence = verified
    ? normalizeVisualEvidence([verified.concreteObservation, verified.standoutMoment, verified.sceneSummary, verified.composition, verified.cameraDistanceOrFraming, verified.visibleChangeOrContrast, verified.motionCue].filter(Boolean).join(" / "))
    : "";
  const humanObservation = humanObservationFromEvidence(verified, mediaType);
  const cueConfidence = verified?.confidence ?? (concreteCueFromSource ? "high" : concreteCueFromProduct ? "medium" : "low");
  const visualMoment = visualMomentForContext(mediaType, concreteVisualCue, source);
  const firstImpressionCue = firstImpressionCueForContext(mediaType, source);
  const contrastGap = contrastGapForContext(source, productSource);
  const visualCue = visualCueForContext(productSource, concreteVisualCue);
  return {
    attentionMoment,
    concreteCueFromProduct,
    concreteCueFromSource,
    concreteVisualCue,
    contrastGap,
    cueConfidence,
    firstImpressionCue,
    humanObservation,
    mediaType,
    productSource,
    rawVisualEvidence,
    source,
    verified,
    visualCue,
    visualMoment,
  };
}

function visualStatusFor(facts: PublicCopyFacts, verified: QuoteVisualAnalysis | null) {
  if (verified) return "verified" as const;
  return facts.quoteVisualAnalysis?.status === "partial" ? "partial" as const : "unavailable" as const;
}

function visualFrameCountFor(facts: PublicCopyFacts, mediaType: PublicCopyFacts["visualContext"]) {
  return facts.quoteVisualAnalysis?.frameOrImageCount ?? (mediaType === "text_only" ? 0 : 1);
}

function sceneOrSubjectSummaryFor(verified: QuoteVisualAnalysis | null, concreteCueFromProduct: string, concreteCueFromSource: string, source: string) {
  return verified?.sceneSummary || verified?.subjectSummary || concreteCueFromProduct || concreteCueFromSource || (source ? `元投稿本文: ${source}` : "具体的なscene情報なし");
}

function visibleChangeOrContrastFor(verified: QuoteVisualAnalysis | null, concreteCueFromSource: string, contrastGap: string) {
  return verified?.visibleChangeOrContrast || verified?.beginningVsLaterChange || (concreteCueFromSource && /変わ|違う|ギャップ|途中/.test(concreteCueFromSource) ? concreteCueFromSource : contrastGap);
}

function motionCueFor(verified: QuoteVisualAnalysis | null, mediaType: PublicCopyFacts["visualContext"], concreteCueFromSource: string) {
  return verified?.motionCue || (mediaType === "video" ? (concreteCueFromSource || "冒頭の動きで印象が決まる") : "");
}

function compositionOrStyleFor(verified: QuoteVisualAnalysis | null, productSource: string, source: string) {
  if (verified?.composition) return verified.composition;
  const combinedText = productSource + source;
  if (/アップ|近|主観|自撮り/.test(combinedText)) return "距離感が近い見せ方";
  if (/引き|一枚|1枚|画像|写真/.test(combinedText)) return "1枚で判断させる切り取り";
  return "";
}

function textOverlayCueFor(verified: QuoteVisualAnalysis | null, sourceText: string, source: string) {
  return verified?.textOverlayCue || (/テロップ|字幕|文字|caption/i.test(sourceText) ? source : "");
}

function sourceEvidenceFor(verified: QuoteVisualAnalysis | null, concreteCueFromSource: string, concreteCueFromProduct: string) {
  return verified?.evidenceSource || (concreteCueFromSource ? `source_text:${concreteCueFromSource}` : concreteCueFromProduct ? `product_title_or_genre:${concreteCueFromProduct}` : "");
}

function uncertaintyLevelFor(verified: QuoteVisualAnalysis | null, concreteVisualCue: string, concreteCueFromSource: string) {
  if (verified) return "low" as const;
  if (!concreteVisualCue) return "high" as const;
  return concreteCueFromSource ? "low" as const : "medium" as const;
}

function visualExplainsAppealFor(mediaType: PublicCopyFacts["visualContext"], source: string) {
  return mediaType === "image" || mediaType === "video" || Boolean(source);
}

export function visualUnderstandingFor(facts: PublicCopyFacts): VisualUnderstanding {
  const {
    attentionMoment,
    concreteCueFromProduct,
    concreteCueFromSource,
    concreteVisualCue,
    contrastGap,
    cueConfidence,
    firstImpressionCue,
    humanObservation,
    mediaType,
    productSource,
    rawVisualEvidence,
    source,
    verified,
    visualCue,
    visualMoment,
  } = visualUnderstandingEvidenceFor(facts);
  return {
    visualAnalysisStatus: visualStatusFor(facts, verified),
    analyzerVersion: facts.quoteVisualAnalysis?.analyzerVersion ?? MYFANS_VISUAL_ANALYZER_VERSION,
    mediaType,
    frameOrImageCount: visualFrameCountFor(facts, mediaType),
    sceneOrSubjectSummary: sceneOrSubjectSummaryFor(verified, concreteCueFromProduct, concreteCueFromSource, source),
    subjectSummary: verified?.subjectSummary || "",
    visibleChangeOrContrast: visibleChangeOrContrastFor(verified, concreteCueFromSource, contrastGap),
    visualMoment: verified?.standoutMoment || visualMoment,
    firstImpressionCue,
    contrastGap,
    visualCue,
    motionCue: motionCueFor(verified, mediaType, concreteCueFromSource),
    compositionOrStyle: compositionOrStyleFor(verified, productSource, source),
    facialExpressionOrPoseCue: verified?.facialExpressionOrPoseCue || "",
    cameraDistanceOrFraming: verified?.cameraDistanceOrFraming || "",
    textOverlayCue: textOverlayCueFor(verified, facts.sourceText, source),
    sourceTextCue: concreteCueFromSource,
    sourceAngle: source,
    concreteVisualCue,
    cueConfidence,
    sourceEvidence: sourceEvidenceFor(verified, concreteCueFromSource, concreteCueFromProduct),
    evidenceSource: verified?.evidenceSource || "",
    rawVisualEvidence,
    humanObservation,
    attentionMoment,
    attentionValue: attentionValueForText(attentionMoment),
    uncertaintyLevel: uncertaintyLevelFor(verified, concreteVisualCue, concreteCueFromSource),
    visualExplainsAppeal: visualExplainsAppealFor(mediaType, source),
    standoutMoment: verified?.standoutMoment || "",
  };
}

export function reactionTypeFor(facts: PublicCopyFacts, variant = 0): HumanReactionType {
  const types: HumanReactionType[] = facts.visualContext === "video"
    ? ["immediacy", "curiosity", "contrast", "agreement", "surprise", "specific_appeal", "unexpected", "visual_clarity"]
    : facts.visualContext === "image"
      ? ["visual_clarity", "agreement", "specific_appeal", "curiosity", "surprise", "unexpected", "immediacy", "contrast"]
      : ["curiosity", "agreement", "unexpected", "surprise", "specific_appeal", "immediacy", "visual_clarity", "contrast"];
  return types[variant % types.length];
}

export function copySearchAngleFor(reasonToCare: MyfansReasonToCare | null | undefined, variant = 0): CopySearchAngle {
  const byReason: Record<MyfansReasonToCare, CopySearchAngle[]> = {
    visual_gap: ["contrast", "direct_reaction", "visual_specificity", "curiosity", "surprise", "editorial_insight"],
    rare_visual_moment: ["visual_specificity", "curiosity", "direct_reaction", "contrast", "surprise", "social_proof_secondary"],
    unexpected_popularity: ["direct_reaction", "social_proof_secondary", "surprise", "curiosity", "contrast", "editorial_insight"],
    rapid_growth: ["surprise", "social_proof_secondary", "direct_reaction", "curiosity", "contrast", "editorial_insight"],
    creator_outlier: ["editorial_insight", "direct_reaction", "contrast", "curiosity", "visual_specificity", "social_proof_secondary"],
    ranking_anomaly: ["editorial_insight", "contrast", "surprise", "direct_reaction", "social_proof_secondary", "curiosity"],
    clear_comparison: ["contrast", "editorial_insight", "direct_reaction", "visual_specificity", "curiosity", "surprise"],
    conversation_worthy: ["curiosity", "direct_reaction", "surprise", "contrast", "visual_specificity", "editorial_insight"],
    strong_human_story: ["direct_reaction", "curiosity", "visual_specificity", "contrast", "editorial_insight", "surprise"],
    price_anomaly: ["editorial_insight", "contrast", "direct_reaction", "social_proof_secondary", "curiosity", "surprise"],
  };
  const fallback: CopySearchAngle[] = ["direct_reaction", "surprise", "contrast", "curiosity", "visual_specificity", "editorial_insight"];
  const angles = reasonToCare ? byReason[reasonToCare] : fallback;
  return angles[variant % angles.length];
}

export function roleFitsReasonToCare(role: DailyRole, reasonToCare: MyfansReasonToCare | null | undefined) {
  if (!reasonToCare) return false;
  const fits: Record<MyfansReasonToCare, DailyRole[]> = {
    visual_gap: ["ATTENTION", "DISCOVERY"],
    rare_visual_moment: ["ATTENTION", "DISCOVERY"],
    unexpected_popularity: ["DISCOVERY", "ATTENTION", "AUTHORITY"],
    rapid_growth: ["DISCOVERY", "AUTHORITY", "ATTENTION"],
    creator_outlier: ["DISCOVERY", "AUTHORITY"],
    ranking_anomaly: ["DISCOVERY", "AUTHORITY"],
    clear_comparison: ["AUTHORITY", "DISCOVERY"],
    conversation_worthy: ["ATTENTION", "DISCOVERY", "AUTHORITY"],
    strong_human_story: ["ATTENTION", "AUTHORITY"],
    price_anomaly: ["REVENUE", "DISCOVERY", "AUTHORITY"],
  };
  return fits[reasonToCare].includes(role);
}
