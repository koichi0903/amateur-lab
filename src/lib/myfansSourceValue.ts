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

function ageDays(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 86_400_000);
}

function hasVerifiedVisual(input: SourceValueInput) {
  return Boolean(input.mediaPermalink && input.quoteVisualReady && (input.mediaType === "image" || input.mediaType === "video"))
    || input.visualAnalysisStatus === "verified";
}

function publicReactionSignal(input: SourceValueInput) {
  return (input.views ?? 0) >= 50_000 || (input.likes ?? 0) >= 1_000 || (input.reposts ?? 0) >= 100 || (input.replies ?? 0) >= 50;
}

export function evaluateMyfansSourceValue(input: SourceValueInput): MyfansSourceValue {
  const text = input.text.normalize("NFKC").replace(/\s+/g, " ").trim();
  const age = ageDays(input.postedAt ?? input.collectedAt);
  const verifiedVisual = hasVerifiedVisual(input);
  const visualAvailable = Boolean(input.mediaType && input.mediaType !== "none" && (input.mediaPermalink || input.visualAnalysisStatus === "partial" || input.visualAnalysisStatus === "verified"));
  const subject = SUBJECT_WORD.test(text);
  const event = EVENT_WORD.test(text) || /[。！？!?]/u.test(text);
  const concrete = Math.min(20, (subject ? 10 : 0) + (event ? 7 : 0) + (text.includes("、") || text.includes("から") || text.includes("まで") ? 3 : 0));
  const reactionAngles = [
    /なぜ|どうして|？|\?/u.test(text) ? "curiosity" : "",
    /変わ|違|比較|から.*まで|一方|なのに/u.test(text) ? "contrast" : "",
    /驚|意外|初めて|思ったより|まさか/u.test(text) ? "surprise" : "",
    /わかる|共感|好き|苦手|気になる/u.test(text) ? "agreement" : "",
    verifiedVisual ? "visual_clarity" : "",
    publicReactionSignal(input) ? "social_proof" : "",
  ].filter(Boolean);
  const reaction = Math.min(16, reactionAngles.length * 5 + (event ? 2 : 0) + (verifiedVisual ? 3 : 0));
  const urlOnly = !text || URL_ONLY.test(text);
  const metricsOnly = Boolean(text && METRICS_ONLY.test(text));
  const selfContained = Math.min(16, urlOnly || metricsOnly ? 0 : (subject ? 9 : 4) + (event ? 5 : 0) + (text.length >= 10 ? 2 : 0));
  const freshness = age === null ? 2 : age <= 3 ? 12 : age <= 7 ? 8 : age <= 14 ? 3 : 0;
  const evidence = Math.min(14, (text ? 5 : 0) + (verifiedVisual ? 8 : visualAvailable ? 2 : 0) + (publicReactionSignal(input) ? 3 : 0));
  const downstreamFit = Math.min(10, (subject && event ? 6 : subject ? 3 : 0) + (reactionAngles.length ? 2 : 0) + (verifiedVisual || text.length >= 12 ? 2 : 0));
  const spamPromoPenalty = Math.min(20, (PROMO.test(text) ? 10 : 0) + (urlOnly ? 8 : 0) + (input.isQuote ? 2 : 0));
  const visualDependency = text.length < 24 && !subject && !event;
  const ambiguityPenalty = Math.min(18, (visualDependency && !verifiedVisual ? 14 : 0) + (input.mediaType !== "none" && !visualAvailable && text.length < 24 ? 4 : 0) + (metricsOnly ? 10 : 0));
  const sourceSpecificity = Math.min(100, concrete * 5 + (verifiedVisual ? 20 : 0) + (event ? 15 : 0));
  const reasons = [
    concrete >= 14 ? "具体的なsubject/eventあり" : "具体的なsubject/eventが弱い",
    reactionAngles.length ? `reaction angle: ${reactionAngles.join(", ")}` : "自然なreaction angleなし",
    selfContained >= 10 ? "本文だけで文脈が通る" : "本文だけでは文脈が弱い",
    verifiedVisual ? "verified visualあり" : visualAvailable ? "media metadataあり" : "visual根拠なし",
    age !== null && age > 14 ? "stale" : "freshness許容範囲",
    PROMO.test(text) ? "定型promo/販売告知を減点" : "定型promoなし",
  ];
  const rawScore = concrete + reaction + selfContained + freshness + evidence + downstreamFit - spamPromoPenalty - ambiguityPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 100 / 102)));
  const hardReject = !text || urlOnly || metricsOnly || Boolean(input.isRepost) || (age !== null && age > 14) || (visualDependency && !verifiedVisual);
  const threshold = verifiedVisual ? 55 : 60;
  const verdict = !hardReject && score >= threshold && concrete >= 10 && reactionAngles.length > 0 && selfContained >= 8 ? "PASS" : "LOW_SOURCE_VALUE";
  return {
    score,
    verdict,
    sourceSpecificity,
    reactionAngles,
    reasons,
    breakdown: { concreteSubjectEvent: concrete, reactionAffordance: reaction, selfContainedContext: selfContained, noveltyFreshness: freshness, evidenceRichness: evidence, downstreamFit, spamPromoPenalty, ambiguityPenalty },
  };
}
