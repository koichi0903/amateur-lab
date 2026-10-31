import { daysSinceIso } from "@/lib/myfans/myfansTime";

export type SourceValueInput = {
  text: string;
  postedAt?: string | null;
  collectedAt?: string | null;
  mediaType?: "image" | "video" | "none" | null;
  mediaPermalink?: string | null;
  quoteVisualReady?: boolean | null;
  visualAnalysisStatus?: "verified" | "partial" | "unavailable" | null;
  views?: number | null;
  likes?: number | null;
  reposts?: number | null;
  replies?: number | null;
  isRepost?: boolean;
  isReply?: boolean;
  isQuote?: boolean;
};

export type MyfansSourceValue = {
  score: number;
  verdict: "PASS" | "LOW_SOURCE_VALUE";
  sourceSpecificity: number;
  reactionAngles: string[];
  reasons: string[];
  breakdown: {
    concreteSubjectEvent: number;
    reactionAffordance: number;
    selfContainedContext: number;
    noveltyFreshness: number;
    evidenceRichness: number;
    downstreamFit: number;
    spamPromoPenalty: number;
    ambiguityPenalty: number;
  };
};

const URL_ONLY = /^(?:https?:\/\/\S+|[#＃][^\s]+|[\p{Extended_Pictographic}\s])+$/u;
const METRICS_ONLY = /^[\d\s.,、。!?！？%％¥￥円+\-/:|｜]+$/u;
const PROMO = /(販売中|発売中|購入|詳しくは|リンクから|チェックして|キャンペーン|セール|限定|予約受付|新商品|PR|広告|アフィリエイト)/i;
const SUBJECT_WORD = /(本人|彼女|彼|作品|投稿|動画|写真|画像|シーン|表情|雰囲気|衣装|制服|階段|海|部屋|新作|新着|続編|更新|公開|発売|解禁|追加|再販|固定|返信|リプ|ランキング|価格|値段|反応|いいね|表示)/u;
const EVENT_WORD = /(変わる|変化|切り替わる|始まる|終わる|出た|出てる|公開された|上がる|急上昇|伸びる|落ちる|違う|残る|見える|分かれる|増えた|減った|出てきた|気になる|驚く|感じる|思う)/u;

function hasVerifiedVisual(input: SourceValueInput) {
  return Boolean(input.mediaPermalink && input.quoteVisualReady && (input.mediaType === "image" || input.mediaType === "video"))
    || input.visualAnalysisStatus === "verified";
}

function publicReactionSignal(input: SourceValueInput) {
  return (input.views ?? 0) >= 50_000 || (input.likes ?? 0) >= 1_000 || (input.reposts ?? 0) >= 100 || (input.replies ?? 0) >= 50;
}

type SourceValueSignals = {
  text: string;
  age: number | null;
  verifiedVisual: boolean;
  visualAvailable: boolean;
  subject: boolean;
  event: boolean;
  urlOnly: boolean;
  metricsOnly: boolean;
};

export function evaluateMyfansSourceValue(input: SourceValueInput): MyfansSourceValue {
  const signals = sourceValueSignals(input);
  const reactionAngles = sourceReactionAngles(input, signals);
  const breakdown = sourceValueBreakdown(input, signals, reactionAngles);
  const sourceSpecificity = sourceSpecificityScore(breakdown.concreteSubjectEvent, signals);
  const reasons = sourceValueReasons(signals, breakdown, reactionAngles);
  const rawScore = breakdown.concreteSubjectEvent + breakdown.reactionAffordance + breakdown.selfContainedContext
    + breakdown.noveltyFreshness + breakdown.evidenceRichness + breakdown.downstreamFit
    - breakdown.spamPromoPenalty - breakdown.ambiguityPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 100 / 102)));
  const hardReject = sourceValueHardReject(input, signals);
  const verdict = sourceValueVerdict(score, hardReject, signals, breakdown, reactionAngles);
  return {
    score,
    verdict,
    sourceSpecificity,
    reactionAngles,
    reasons,
    breakdown,
  };
}

function sourceValueSignals(input: SourceValueInput): SourceValueSignals {
  const text = input.text.normalize("NFKC").replace(/\s+/g, " ").trim();
  const textSignals = sourceTextSignals(text);
  return {
    text,
    age: daysSinceIso(input.postedAt ?? input.collectedAt),
    verifiedVisual: hasVerifiedVisual(input),
    visualAvailable: sourceVisualAvailable(input),
    ...textSignals,
  };
}

function sourceTextSignals(text: string) {
  return {
    subject: SUBJECT_WORD.test(text),
    event: EVENT_WORD.test(text) || /[。！？!?]/u.test(text),
    urlOnly: !text || URL_ONLY.test(text),
    metricsOnly: Boolean(text && METRICS_ONLY.test(text)),
  };
}

function sourceVisualAvailable(input: SourceValueInput) {
  return Boolean(input.mediaType && input.mediaType !== "none" && (input.mediaPermalink || input.visualAnalysisStatus === "partial" || input.visualAnalysisStatus === "verified"));
}

function sourceReactionAngles(input: SourceValueInput, signals: SourceValueSignals) {
  const { text, verifiedVisual } = signals;
  return [
    /なぜ|どうして|？|\?/u.test(text) ? "curiosity" : "",
    /変わ|違|比較|から.*まで|一方|なのに/u.test(text) ? "contrast" : "",
    /驚|意外|初めて|思ったより|まさか/u.test(text) ? "surprise" : "",
    /わかる|共感|好き|苦手|気になる/u.test(text) ? "agreement" : "",
    verifiedVisual ? "visual_clarity" : "",
    publicReactionSignal(input) ? "social_proof" : "",
  ].filter(Boolean);
}

function sourceValueBreakdown(input: SourceValueInput, signals: SourceValueSignals, reactionAngles: string[]): MyfansSourceValue["breakdown"] {
  const concreteSubjectEvent = sourceConcreteScore(signals);
  const reactionAffordance = sourceReactionScore(signals, reactionAngles);
  const selfContainedContext = sourceSelfContainedScore(signals);
  const noveltyFreshness = sourceFreshnessScore(signals.age);
  const evidenceRichness = sourceEvidenceScore(input, signals);
  const downstreamFit = sourceDownstreamFit(signals, reactionAngles);
  const spamPromoPenalty = sourcePromoPenalty(input, signals);
  const ambiguityPenalty = sourceAmbiguityPenalty(input, signals);
  return { concreteSubjectEvent, reactionAffordance, selfContainedContext, noveltyFreshness, evidenceRichness, downstreamFit, spamPromoPenalty, ambiguityPenalty };
}

function sourceConcreteScore(signals: SourceValueSignals) {
  const { text, subject, event } = signals;
  const hasDetailConnector = text.includes("、") || text.includes("から") || text.includes("まで");
  return Math.min(20, (subject ? 10 : 0) + (event ? 7 : 0) + (hasDetailConnector ? 3 : 0));
}

function sourceReactionScore(signals: SourceValueSignals, reactionAngles: string[]) {
  return Math.min(16, reactionAngles.length * 5 + (signals.event ? 2 : 0) + (signals.verifiedVisual ? 3 : 0));
}

function sourceSelfContainedScore(signals: SourceValueSignals) {
  if (signals.urlOnly || signals.metricsOnly) return 0;
  return Math.min(16, (signals.subject ? 9 : 4) + (signals.event ? 5 : 0) + (signals.text.length >= 10 ? 2 : 0));
}

function sourceFreshnessScore(age: number | null) {
  if (age === null) return 2;
  if (age <= 3) return 12;
  if (age <= 7) return 8;
  return age <= 14 ? 3 : 0;
}

function sourceEvidenceScore(input: SourceValueInput, signals: SourceValueSignals) {
  const visualEvidence = signals.verifiedVisual ? 8 : signals.visualAvailable ? 2 : 0;
  return Math.min(14, (signals.text ? 5 : 0) + visualEvidence + (publicReactionSignal(input) ? 3 : 0));
}

function sourceDownstreamFit(signals: SourceValueSignals, reactionAngles: string[]) {
  const subjectEventFit = signals.subject && signals.event ? 6 : signals.subject ? 3 : 0;
  const reactionFit = reactionAngles.length ? 2 : 0;
  const visualOrContextFit = signals.verifiedVisual || signals.text.length >= 12 ? 2 : 0;
  return Math.min(10, subjectEventFit + reactionFit + visualOrContextFit);
}

function sourcePromoPenalty(input: SourceValueInput, signals: SourceValueSignals) {
  return Math.min(20, (PROMO.test(signals.text) ? 10 : 0) + (signals.urlOnly ? 8 : 0) + (input.isQuote ? 2 : 0));
}

function sourceAmbiguityPenalty(input: SourceValueInput, signals: SourceValueSignals) {
  const visualDependency = isSourceVisualDependent(signals);
  const missingVisualPenalty = visualDependency && !signals.verifiedVisual ? 14 : 0;
  const mediaWithoutEvidencePenalty = input.mediaType !== "none" && !signals.visualAvailable && signals.text.length < 24 ? 4 : 0;
  return Math.min(18, missingVisualPenalty + mediaWithoutEvidencePenalty + (signals.metricsOnly ? 10 : 0));
}

function isSourceVisualDependent(signals: SourceValueSignals) {
  return signals.text.length < 24 && !signals.subject && !signals.event;
}

function sourceSpecificityScore(concrete: number, signals: SourceValueSignals) {
  return Math.min(100, concrete * 5 + (signals.verifiedVisual ? 20 : 0) + (signals.event ? 15 : 0));
}

function sourceValueReasons(signals: SourceValueSignals, breakdown: MyfansSourceValue["breakdown"], reactionAngles: string[]) {
  return [
    breakdown.concreteSubjectEvent >= 14 ? "具体的なsubject/eventあり" : "具体的なsubject/eventが弱い",
    reactionAngles.length ? `reaction angle: ${reactionAngles.join(", ")}` : "自然なreaction angleなし",
    breakdown.selfContainedContext >= 10 ? "本文だけで文脈が通る" : "本文だけでは文脈が弱い",
    visualValueReason(signals),
    signals.age !== null && signals.age > 14 ? "stale" : "freshness許容範囲",
    PROMO.test(signals.text) ? "定型promo/販売告知を減点" : "定型promoなし",
  ];
}

function visualValueReason(signals: SourceValueSignals) {
  if (signals.verifiedVisual) return "verified visualあり";
  return signals.visualAvailable ? "media metadataあり" : "visual根拠なし";
}

function sourceValueHardReject(input: SourceValueInput, signals: SourceValueSignals) {
  const stale = signals.age !== null && signals.age > 14;
  const missingVisual = isSourceVisualDependent(signals) && !signals.verifiedVisual;
  return !signals.text || signals.urlOnly || signals.metricsOnly || Boolean(input.isRepost) || stale || missingVisual;
}

function sourceValueVerdict(score: number, hardReject: boolean, signals: SourceValueSignals, breakdown: MyfansSourceValue["breakdown"], reactionAngles: string[]) {
  const threshold = signals.verifiedVisual ? 55 : 60;
  const passesThresholds = score >= threshold && breakdown.concreteSubjectEvent >= 10
    && reactionAngles.length > 0 && breakdown.selfContainedContext >= 8;
  return !hardReject && passesThresholds ? "PASS" : "LOW_SOURCE_VALUE";
}
