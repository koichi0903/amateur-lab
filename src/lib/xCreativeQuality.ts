import { getXWeightedLength } from "@/lib/xText";
import { primaryUsableVisualFact } from "@/lib/xVisualVideoFacts";
import { calculateHookScore, clamp, evidenceLines, hasRankingTrend, pct, primaryActress, primaryVideoTag, strongestFacts, yen } from "./xCreativeInputFacts";
import type { XCopyGrammarValidation, XCreativeInput, XCreativeMedia, XCreativeStructure, XGrowthIntent, XLinkPlan, XQualityDimension } from "./xCreativeTypes";

const PROMO_WORDS = ["期間限定", "今すぐ", "詳細はこちら", "お得", "🔥", "絶対", "見逃し厳禁", "セール中", "激安"];

const FORBIDDEN_PUBLIC_WORDS = [
  "本文では", "カードで", "見る順番を置く",
  "入口が作れる", "観察ポイント", "確認する価値", "今日買う理由が残る", "安全です", "価格条件は強め",
  "この条件なら", "根拠がそろっている", "広告っぽい", "広告っぽく見えない", "確認する価値があります",
  "今見る理由があります", "順位、評価、価格の根拠がそろっています", "データ上", "データ上では", "スコア",
  "スコア的に", "数字の組み合わせ",
  "数字の組み合わせです", "価格異常", "Opportunity", "Freshness", "発掘指数", "買い時スコア", "価格条件は強め",
  "投稿する価値", "確認する位置", "データ補足", "候補化", "候補です", "候補では", "比較候補",
  "覚えておく方が役に立つ", "拾うなら", "中身として拾いたい", "拾いたい", "入口", "観察",
  "比較メモ", "自然です", "差は大きく見せず", "価格条件", "中身として拾いたい",
  "過去価格との差で止まる日", "本文で説明するより", "動画あり",
  "短く見て決められます", "まず見る場所", "どこを見るか", "刺さるなら", "見ていいと思います",
  "タイトルだけなら流してました", "サンプルまで見ると印象が変わる", "サンプルまで見ると印象が変わりそう",
  "最初に見る場所", "まずだけ", "今日見る場所",
  "本文では", "カードで", "候補", "確認する価値", "刺さる題材だけ見れば十分", "外しにくい",
  "画像で雰囲気は伝わるので", "本文は短くてよさそう", "カードは補助", "気になる一本だけ見れば足ります",
  "半額だけでなく評価も高いので", "気になっていたなら今日は",
];

const FORBIDDEN_TEMPORAL_WORDS = ["上がってきた", "急上昇", "昨日より", "伸びている", "伸びてきた", "見つかり始めた", "勢いがある", "動きが出ています"];






























export function concreteVisualPhrases(fact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>) {
  if (fact.kind === "jacket_sample_mismatch" || /ジャケとサンプルで印象/.test(fact.safePhrase ?? "")) {
    return ["ジャケとサンプルで見え方が違う。", "表紙の印象とサンプルの雰囲気が少し違う。", "ジャケを見た印象と、動画の入り方に差がある。"];
  }
  if (/入り方が少し予想と違う/.test(fact.safePhrase ?? "") || fact.value === "opening_change") {
    return ["冒頭の展開が予想と少し違う。", "再生してすぐ、想像していた流れと変わった。", "冒頭の入り方が、思っていた流れと少し違う。"];
  }
  if (fact.value === "first_seconds_attention") {
    return ["開いてすぐ、画面の変化に目が止まる。", "最初の数秒で、画面の動きが気になった。", "再生直後の動きに、思わず目が止まる。"];
  }
  if (fact.value === "safe_preview") {
    return ["サンプルの冒頭だけで、見え方が分かる。", "冒頭を少し見ただけでも、作品の雰囲気が伝わる。", "短いサンプルでも、入り方は確かめられる。"];
  }
  return [fact.safePhrase ?? ""].filter(Boolean);
}
export function containsConcreteVisualPhrase(text: string, fact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>) {
  return concreteVisualPhrases(fact).some((phrase) => phrase && text.includes(phrase.replace(/[。．]+$/, "")));
}


/** Reject copy whose grammar implies facts or comparisons the source does not support. */
export function validateXCopyGrammar(input: Pick<XCreativeInput, "sourceType">, text: string): XCopyGrammarValidation {
  const reasons: string[] = [];
  if (/AI生成作品\s*の一本|作品\s+の一本|ジャンル\s*の一本/.test(text)) reasons.push("機械的なカテゴリ主語");
  if (/迷う人は|同じ\d+%?OFFでも|似た条件でも|安さで並べても/.test(text) && input.sourceType !== "COMPARISON") {
    reasons.push("比較対象が確定していない比較文");
  }
  if (/雰囲気だけ|空気だけ|入り方が少し予想と違う/.test(text)) reasons.push("抽象Factだけの表現");
  return { passed: reasons.length === 0, reasons };
}


export function sanitizePublicText(text: string) {
  return FORBIDDEN_PUBLIC_WORDS.reduce((current, word) => current.replaceAll(word, ""), text)
    .replaceAll("こういうを", "これを")
    .replace(/[.…]{2,}/g, "")
    .replace(/\s+寄り/g, "寄り")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


const NATIVE_X_FORBIDDEN_PHRASES = [
  "このズレだけで、一回止まる理由になります",
  "今日は短く見て決められます",
  "まず見る場所",
  "どこを見るか",
  "タイトルだけなら流してました",
  "サンプルまで見ると印象が変わる",
  "理由になります",
  "方が外しにくい",
  "で決めやすい",
  "確認する価値",
  "画像で雰囲気は伝わるので",
  "本文は短くてよさそう",
  "カードは補助",
  "気になる一本だけ見れば足ります",
  "気になっていたなら今日は",
];


type NativeVoiceVariant = { intent: XGrowthIntent; mediaType: XCreativeMedia; text: string };

function nativeLinePattern(line: string) {
  return /評価|ランキング|OFF|円|レビュー/.test(line) ? "proof" : /^https?:\/\//.test(line) ? "link" : "story";
}

function nativeSentencePattern(lines: string[]) {
  return lines.map(nativeLinePattern).join("+");
}

function nativeSubjectPosition(input: XCreativeInput, first: string) {
  const actress = primaryActress(input);
  return actress && first.startsWith(actress) ? "actress_first" : first.startsWith("「") ? "title_first" : /今日|同じ|似た|ランキング|安い/.test(first) ? "market_first" : "feeling_first";
}

function recentNativeLogs(input: XCreativeInput) {
  return (input.recentLogs ?? []).filter((log) => Date.now() - new Date(log.posted_at).getTime() <= 7 * 86_400_000);
}

function nativeFingerprintMatches(input: XCreativeInput, log: NonNullable<XCreativeInput["recentLogs"]>[number], sentencePattern: string, subjectPosition: string) {
  const logLines = log.post_text.split("\n").map((line) => line.trim()).filter(Boolean);
  const logFirst = logLines[0] ?? "";
  return nativeSentencePattern(logLines) === sentencePattern && nativeSubjectPosition(input, logFirst) === subjectPosition;
}

function isRepeatedNativePhrase(line: string, recentLogs: NonNullable<XCreativeInput["recentLogs"]>) {
  return line.length >= 8 && recentLogs.filter((log) => log.post_text.includes(line)).length >= 2;
}

function collectNativeVoiceFacts(input: XCreativeInput, variant: NativeVoiceVariant) {
  const lines = variant.text.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const recentSevenDays = recentNativeLogs(input);
  const sentencePattern = nativeSentencePattern(lines);
  const subjectPosition = nativeSubjectPosition(input, first);
  const forbiddenHits = NATIVE_X_FORBIDDEN_PHRASES.filter((phrase) => variant.text.includes(phrase));
  const softTemplateHits = ["刺さるなら", "見ていいと思います", "な一本です", "タイプです"].filter((phrase) => variant.text.includes(phrase));
  const recentSimilarity = Math.max(0, ...recentSevenDays.slice(0, 30).map((log) => similarity(variant.text, log.post_text)));
  const sameFingerprintCount = recentSevenDays.filter((log) => nativeFingerprintMatches(input, log, sentencePattern, subjectPosition)).length;
  const frequentPhraseHits = lines.filter((line) => isRepeatedNativePhrase(line, recentSevenDays));
  const digitCount = (variant.text.match(/\d/g) ?? []).length;
  const actress = primaryActress(input);
  return {
    lines,
    first,
    forbiddenHits,
    softTemplateHits,
    recentSimilarity,
    sameFingerprintCount,
    frequentPhraseHits,
    digitCount,
    startsWithActressEveryTime: Boolean(actress && first.startsWith(actress)),
    reviewSiteTone: /確認|判断|価値|優先|採用|根拠|訴求|導線|おすすめ/.test(variant.text),
    operatorVoice: /止まる理由|読まれ|使う|投稿|本文|Hook|動画を置く|運用|REACH|クリック/.test(variant.text),
    emotionalFirstLine: /気になる|止ま|好き|違う|ズレ|迷う|見落|空気|こっち|正直|なんか|意外|早い|もったいない|外しそう|引っか|流して|弱い|強い|合う|寄って|印象|ジャケ|表紙|中身|決めない|半額だけ|数字より|選び方|差が|差あり/.test(first),
    tooPolished: lines.length >= 3 && lines.every((line) => /です。|ます。|ました。|ます$|です$/.test(line)),
    brokenText: /、です|で、。|。、|^、|。\s*、/.test(variant.text),
  };
}

function buildNativeVoiceChecks(variant: NativeVoiceVariant, facts: ReturnType<typeof collectNativeVoiceFacts>) {
  return {
    timelineNative: facts.lines.length >= 1 && facts.lines.length <= 3 && facts.first.length >= 8 && facts.digitCount <= (variant.intent === "MONEY" ? 10 : 6),
    notOperatorVoice: !facts.operatorVoice,
    notReviewSite: !facts.reviewSiteTone || variant.intent === "MONEY",
    emotionalFirstLine: facts.emotionalFirstLine,
    notTooPolished: !facts.tooPolished,
    noTemplateReuse: facts.forbiddenHits.length === 0 && facts.softTemplateHits.length <= 1 && facts.recentSimilarity < 0.58 && facts.sameFingerprintCount < 2 && facts.frequentPhraseHits.length === 0,
    subjectVariety: !facts.startsWithActressEveryTime || facts.emotionalFirstLine || variant.mediaType === "sample_movie",
  };
}

function buildNativeVoiceReasons(facts: ReturnType<typeof collectNativeVoiceFacts>, checks: ReturnType<typeof buildNativeVoiceChecks>) {
  return [
    !checks.timelineNative ? "Xの流れより説明文に寄っている" : "",
    !checks.notOperatorVoice ? "運用者視点の言葉が残っている" : "",
    !checks.notReviewSite ? "レビューサイト文っぽい" : "",
    !checks.emotionalFirstLine ? "1行目に感情・違和感・発見が薄い" : "",
    !checks.notTooPolished ? "整いすぎてAIテンプレに見える" : "",
    facts.brokenText ? "禁止語除去後の文が不自然" : "",
    !checks.noTemplateReuse ? `直近/禁止テンプレ重複${facts.forbiddenHits.length ? `: ${facts.forbiddenHits.join(", ")}` : facts.frequentPhraseHits.length ? `: ${facts.frequentPhraseHits.join(", ")}` : facts.sameFingerprintCount >= 2 ? `: 同型fingerprint ${facts.sameFingerprintCount}回` : facts.recentSimilarity >= 0.58 ? `: 類似度${Math.round(facts.recentSimilarity * 100)}%` : ""}` : "",
    !checks.subjectVariety ? "女優名冒頭の型に寄りすぎ" : "",
  ].filter(Boolean);
}

export function finalNativeXVoiceGate(input: XCreativeInput, variant: NativeVoiceVariant) {
  const facts = collectNativeVoiceFacts(input, variant);
  const checks = buildNativeVoiceChecks(variant, facts);
  const reasons = buildNativeVoiceReasons(facts, checks);
  return { passed: reasons.length === 0, checks, forbiddenHits: [...facts.forbiddenHits, ...facts.softTemplateHits, ...facts.frequentPhraseHits], reasons };
}


type HumanVoiceVariant = { intent: XGrowthIntent; mediaType: XCreativeMedia; linkPlan: XLinkPlan; text: string };

function collectHumanVoiceFacts(input: XCreativeInput, variant: HumanVoiceVariant) {
  const lines = variant.text.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const forbiddenHits = FORBIDDEN_PUBLIC_WORDS.filter((word) => variant.text.includes(word));
  const repeatedFacts = factOccurrences(variant.text, input);
  const hasReaderVerb = /見る|見て|迷|決め|止ま|流|拾|比べ|買|見送|気にな|刺さ|引っかか|伝わ/.test(variant.text);
  const internalMetricLeak = /発掘指数|買い時|CTR|PV|FANZA|Opportunity|Freshness|score|スコア|候補/.test(variant.text);
  const abstractOpening = /^(強い|弱い|良い|悪い|自然|安全|価値|候補|判断|確認)/.test(first) || first.length < 12;
  const grammar = validateXCopyGrammar(input, variant.text);
  const primaryFact = primaryUsableVisualFact(input.visualFacts);
  const concreteVisualFact = variant.intent === "MONEY"
    || variant.mediaType !== "sample_movie"
    || !primaryFact
    || !input.visualFacts?.usableFacts.length
    || Boolean(primaryFact && containsConcreteVisualPhrase(variant.text, primaryFact));
  return { lines, first, forbiddenHits, repeatedFacts, hasReaderVerb, internalMetricLeak, abstractOpening, grammar, concreteVisualFact };
}

function buildHumanVoiceChecks(input: XCreativeInput, variant: HumanVoiceVariant, facts: ReturnType<typeof collectHumanVoiceFacts>) {
  return {
    xNative: facts.lines.length >= 1 && facts.lines.length <= 5 && !/[。\.].*[。\.].*[。\.]/.test(facts.first),
    audienceClear: Boolean(primaryActress(input) || input.genre || facts.first.includes("今日") || facts.first.includes("同じ") || facts.first.includes("半額") || facts.first.includes("ランキング")),
    readerAction: facts.hasReaderVerb,
    noInternalMetric: !facts.internalMetricLeak && facts.forbiddenHits.length === 0,
    noRepeatedFact: facts.repeatedFacts.length === 0,
    concreteOpening: !facts.abstractOpening && !lineStartsWithNumber(variant.text),
    concreteVisualFact: facts.concreteVisualFact,
  };
}

function buildHumanVoiceReasons(facts: ReturnType<typeof collectHumanVoiceFacts>, checks: ReturnType<typeof buildHumanVoiceChecks>) {
  const reasons = [
    !checks.xNative ? "普通のX投稿より説明文に寄っている" : "",
    !checks.audienceClear ? "誰向けの話か冒頭で分かりにくい" : "",
    !checks.readerAction ? "読者の行動/感情に翻訳されていない" : "",
    !checks.noInternalMetric ? `内部/運用者語が残っている${facts.forbiddenHits.length ? `: ${facts.forbiddenHits.join(", ")}` : ""}` : "",
    !checks.noRepeatedFact ? `同じ事実を繰り返している: ${facts.repeatedFacts.join(", ")}` : "",
    !checks.concreteOpening ? "1行目が抽象判断または数字始まり" : "",
    !checks.concreteVisualFact ? "観測されたVisual/Video Factが本文に残っていない" : "",
    ...facts.grammar.reasons,
  ].filter(Boolean);
  return reasons;
}

function finalHumanVoiceGate(input: XCreativeInput, variant: HumanVoiceVariant) {
  const facts = collectHumanVoiceFacts(input, variant);
  const checks = buildHumanVoiceChecks(input, variant, facts);
  const reasons = buildHumanVoiceReasons(facts, checks);
  return { passed: reasons.length === 0, checks, forbiddenHits: facts.forbiddenHits, reasons };
}


function similarity(a: string, b: string) {
  const tokens = new Set(a.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  const other = new Set(b.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  const overlap = [...tokens].filter((token) => other.has(token)).length;
  return overlap / Math.max(tokens.size, other.size, 1);
}


function factOccurrences(text: string, input: XCreativeInput) {
  const facts = [
    input.reviewAverage ? `評価${input.reviewAverage.toFixed(1)}` : "",
    input.ranking ? `ランキング${input.ranking}位` : "",
    input.currentPrice ? yen(input.currentPrice) : "",
    input.discountRate >= 1 ? pct(input.discountRate) : "",
    input.isNinetyDayLow ? "過去90日最安級" : "",
    primaryActress(input) ?? "",
  ].filter(Boolean);
  return facts.filter((fact) => text.split(fact).length - 1 >= 2);
}


function lineStartsWithNumber(text: string) {
  const first = text.split("\n")[0] ?? "";
  if (/^\s*[0-9０-９]+%OFFだけど/.test(first)) return false;
  return /^\s*(評価|レビュー|過去90日|\d|[0-9０-９])/.test(first);
}


type LastMileVariant = { intent: XGrowthIntent; mediaType: XCreativeMedia; linkPlan: XLinkPlan; text: string };

type LastMileFacts = {
  first: string;
  forbiddenHits: string[];
  temporalHits: string[];
  repeated: string[];
  repeatedPhrases: string[];
  slashFacts: number;
  digitCount: number;
  titleTooForced: boolean;
  hasConcreteEntry: boolean;
  hasUrl: boolean;
  mediaWeak: boolean;
  reachApprovalFailures: string[];
};

function hasConcreteEntry(input: XCreativeInput) {
  return Boolean(primaryActress(input) || input.genre || input.imageUrl || input.reviewAverage || input.ranking || input.isNinetyDayLow);
}

function isMediaHookWeak(first: string, mediaType: XCreativeMedia) {
  return mediaType === "text" && !first.includes("見落") && !first.includes("流し") && !first.includes("なぜ") && !first.includes("？") && !first.includes("ひっか") && !first.includes("今日") && !first.includes("同じ") && !first.includes("見送");
}

function buildReachApprovalFailures(input: XCreativeInput, variant: LastMileVariant, first: string, concreteEntry: boolean) {
  if (variant.intent !== "REACH") return [];
  return [
    !concreteEntry || first.length < 14 ? "REACH Approval: 1行目が具体的ではない" : "",
    /市場|傾向|分析|データ|報告/.test(variant.text) && !/見る|迷|止ま|外|差|カード|サンプル/.test(variant.text) ? "REACH Approval: 抽象的な市場説明で終わっている" : "",
    variant.mediaType === "text" && !/ランキング|評価|半額|OFF|見落|差|迷|女優|ジャンル|サンプル/.test(variant.text) ? "REACH Approval: 画像/比較/強い題材のどれも弱い" : "",
    !/今日|今|セール|迷|サンプル|ランキング|半額|OFF|動画|ジャケ|冒頭|開いてすぐ/.test(variant.text) ? "REACH Approval: なぜ今見るかが弱い" : "",
    evaluateAdSmell(variant.text, variant.linkPlan, input) > 30 ? "REACH Approval: 広告臭が強い" : "",
  ].filter(Boolean);
}

function collectLastMileFacts(input: XCreativeInput, variant: LastMileVariant): LastMileFacts {
  const lines = variant.text.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const concreteEntry = hasConcreteEntry(input);
  return {
    first,
    forbiddenHits: FORBIDDEN_PUBLIC_WORDS.filter((word) => variant.text.includes(word)),
    temporalHits: hasRankingTrend(input) ? [] : FORBIDDEN_TEMPORAL_WORDS.filter((word) => variant.text.includes(word)),
    repeated: factOccurrences(variant.text, input),
    repeatedPhrases: ["こういう", "これ"].filter((word) => variant.text.split(word).length - 1 >= 2),
    slashFacts: (variant.text.match(/\//g) ?? []).length,
    digitCount: (variant.text.match(/\d/g) ?? []).length,
    titleTooForced: input.title.length > 42 && variant.text.includes(input.title),
    hasConcreteEntry: concreteEntry,
    hasUrl: /https?:\/\//.test(variant.text),
    mediaWeak: isMediaHookWeak(first, variant.mediaType),
    reachApprovalFailures: buildReachApprovalFailures(input, variant, first, concreteEntry),
  };
}

function buildBaseLastMileReasons(input: XCreativeInput, variant: LastMileVariant, facts: LastMileFacts) {
  return [
    facts.first.length < 12 ? "1行目が弱い" : "",
    lineStartsWithNumber(variant.text) ? "数字始まり" : "",
    facts.forbiddenHits.length ? `内部/分析者臭: ${facts.forbiddenHits.join(", ")}` : "",
    facts.temporalHits.length ? `未確認時系列: ${facts.temporalHits.join(", ")}` : "",
    facts.repeated.length ? `同一事実の重複: ${facts.repeated.join(", ")}` : "",
    facts.repeatedPhrases.length ? `同じ言い回しの重複: ${facts.repeatedPhrases.join(", ")}` : "",
    facts.slashFacts >= 2 || facts.digitCount >= 14 ? "数字羅列に見える" : "",
    !facts.hasConcreteEntry ? "作品を知らない人の入口が弱い" : "",
    facts.titleTooForced || variant.text.includes("…") ? "長い作品名の機械的処理が残っている" : "",
  ];
}

function buildIntentLinkReasons(variant: LastMileVariant, facts: LastMileFacts) {
  return [
    variant.intent === "MONEY" && variant.linkPlan === "body_link" && !facts.hasUrl ? "MONEYなのに本文リンクがない" : "",
    variant.intent === "MONEY" && variant.linkPlan !== "body_link" && variant.linkPlan !== "reply_link" ? "MONEYのリンク戦略が不正" : "",
    variant.intent !== "MONEY" && (variant.linkPlan === "body_link" || facts.hasUrl) ? "認知投稿に直リンクが強すぎる" : "",
  ];
}

function buildLastMileReasons(input: XCreativeInput, variant: LastMileVariant, facts: LastMileFacts, humanVoice: ReturnType<typeof finalHumanVoiceGate>, nativeXVoice: ReturnType<typeof finalNativeXVoiceGate>) {
  return [
    ...buildBaseLastMileReasons(input, variant, facts),
    ...buildIntentLinkReasons(variant, facts),
    facts.mediaWeak ? "テキストのみのHookが弱い" : "",
    ...facts.reachApprovalFailures,
    ...humanVoice.reasons.map((reason) => `Human Voice Gate: ${reason}`),
    ...nativeXVoice.reasons.map((reason) => `Native X Voice Gate: ${reason}`),
  ].filter(Boolean);
}

export function lastMileGate(input: XCreativeInput, variant: LastMileVariant, rewriteCount: number) {
  const facts = collectLastMileFacts(input, variant);
  const humanVoice = finalHumanVoiceGate(input, variant);
  const nativeXVoice = finalNativeXVoiceGate(input, variant);
  const reasons = buildLastMileReasons(input, variant, facts, humanVoice, nativeXVoice);
  return {
    verdict: reasons.length === 0 ? "post_ok" as const : reasons.length <= 2 ? "revise" as const : "do_not_post" as const,
    passed: reasons.length === 0,
    reasons,
    rewriteCount,
    humanVoice,
    nativeXVoice,
  };
}


function evaluateAdSmell(text: string, linkPlan: XLinkPlan, input: XCreativeInput) {
  let penalty = PROMO_WORDS.reduce((sum, word) => sum + (text.includes(word) ? 12 : 0), 0);
  if (linkPlan === "body_link") penalty += 18;
  if (input.discountRate >= 30 && evidenceLines(input).length <= 1) penalty += 18;
  if ((text.match(/\d/g) ?? []).length >= 12) penalty += 18;
  if ((text.match(/\//g) ?? []).length >= 3) penalty += 14;
  if ((text.match(/#PR|#FANZA/g) ?? []).length > 0) penalty += 16;
  return clamp(penalty);
}

type XCreativeQualityVariant = {
  intent: XGrowthIntent;
  structure: XCreativeStructure;
  mediaType: XCreativeMedia;
  linkPlan: XLinkPlan;
  text: string;
};

type QualityScoreSignals = {
  proofCount: number;
  hasVerifiedVideoFact: boolean;
  reachSourceSignal: number;
  reachTextHook: number;
  firstSecondsBoost: number;
  mediaStoryFit: number;
  adSmell: number;
  noveltyPenalty: number;
  historicalWinnerBonus: number;
};

const QUALITY_RULES: Record<XGrowthIntent, Array<[XQualityDimension, number]>> = {
  REACH: [["scrollStop", 70], ["curiosity", 62], ["shareability", 58], ["novelty", 62], ["ctaFit", 70], ["mediaFit", 60]],
  FOLLOW: [["followValue", 70], ["judgment", 68], ["specificity", 62], ["novelty", 55]],
  AUTHORITY: [["proof", 54], ["judgment", 72], ["replyability", 56], ["adSmell", 0], ["mediaFit", 60]],
  MONEY: [["proof", 58], ["ctaFit", 75], ["mediaFit", 65]],
  CONVERSATION: [["curiosity", 68], ["judgment", 64], ["adSmell", 0]],
};

function sampleMovieStoryFit(variant: XCreativeQualityVariant, videoTag: ReturnType<typeof primaryVideoTag>) {
  const linesFit = variant.text.split("\n").filter(Boolean).length <= 3 && !variant.text.includes("http");
  const strongTag = videoTag === "first_seconds_strong" || videoTag === "visual_mismatch" || videoTag === "scene_surprise" || videoTag === "actress_fit";
  return strongTag && linesFit ? 98 : linesFit ? 88 : 72;
}

function dataCardStoryFit(text: string) {
  return /カード|どこから見る|見るなら|迷う|差|ランキングだけ/.test(text) && (text.match(/\d/g) ?? []).length <= 8 ? 92 : 68;
}

function workImageStoryFit(variant: XCreativeQualityVariant) {
  if (variant.intent === "MONEY") return 84;
  return /ジャケ|画像|雰囲気|見た|止ま|流し|気にな|印象/.test(variant.text) ? 88 : 76;
}

function textStoryFit(text: string) {
  return /ランキング|評価|半額|OFF|見落|差|迷|サンプル/.test(text) ? 74 : 55;
}

function mediaStoryFit(variant: XCreativeQualityVariant, videoTag: ReturnType<typeof primaryVideoTag>) {
  switch (variant.mediaType) {
    case "sample_movie": return sampleMovieStoryFit(variant, videoTag);
    case "data_card": return dataCardStoryFit(variant.text);
    case "existing_link_image": return workImageStoryFit(variant);
    default: return textStoryFit(variant.text);
  }
}

function buildAttentionDimensions(input: XCreativeInput, variant: XCreativeQualityVariant, signals: QualityScoreSignals) {
  const { reachSourceSignal, reachTextHook, firstSecondsBoost, proofCount, hasVerifiedVideoFact } = signals;
  return {
    scrollStop: clamp(42 + reachSourceSignal + reachTextHook + firstSecondsBoost + (input.ranking && input.ranking <= 50 ? 10 : 0) + (input.isNinetyDayLow ? 8 : 0) + (input.discoveryScore ?? 0) / 6),
    curiosity: clamp(45 + reachTextHook + (variant.text.includes("なぜ") || variant.text.includes("ズレ") || variant.text.includes("不自然") || variant.text.includes("印象") || variant.text.includes("流して") || variant.text.includes("偏り") || (hasVerifiedVideoFact && /違い|違う|変わった/.test(variant.text)) ? 24 : 0) + proofCount * 5),
  };
}

function buildEvidenceDimensions(input: XCreativeInput, variant: XCreativeQualityVariant, proofCount: number) {
  return {
    proof: clamp(30 + proofCount * 16 + (input.seriesObservationCount ?? 0) * 2),
    judgment: clamp(variant.text.includes("近い") || variant.text.includes("見落と") || variant.text.includes("サンプル") || variant.text.includes("中身") || variant.text.includes("見たい") || variant.text.includes("決め") || variant.text.includes("外し") || variant.text.includes("迷う") || variant.text.includes("差") ? 80 : 48),
    followValue: clamp(variant.intent === "FOLLOW" ? 62 + proofCount * 8 : variant.intent === "AUTHORITY" ? 58 + proofCount * 6 : 42 + proofCount * 4),
    specificity: clamp(36 + proofCount * 14 + (input.currentPrice ? 8 : 0) + (input.reviewCount ? 8 : 0)),
  };
}

function buildNoveltyMediaDimensions(input: XCreativeInput, variant: XCreativeQualityVariant, signals: QualityScoreSignals) {
  return {
    novelty: clamp(82 - signals.noveltyPenalty + (variant.structure === "question" ? 6 : 0) + signals.historicalWinnerBonus),
    adSmell: signals.adSmell,
    ctaFit: clamp(variant.intent === "MONEY" ? (variant.linkPlan === "body_link" ? 86 : 58) : variant.linkPlan === "body_link" ? 30 : 82),
    mediaFit: clamp(variant.mediaType === "sample_movie" && !input.hasRightsCheckedMovie ? 0 : signals.mediaStoryFit),
  };
}

function shareableSourceBonus(sourceType: XCreativeInput["sourceType"]) {
  return sourceType === "MARKET" || sourceType === "COMPARISON" || sourceType === "JUDGMENT" ? 22 : 0;
}

function shareableTextBonus(text: string) {
  const comparisonHook = text.includes("こういう") || text.includes("流して") || text.includes("ランキングだけ");
  const stoppingReason = text.includes("見落と") || text.includes("一回止ま") || text.includes("外し") || text.includes("差が");
  return (comparisonHook ? 18 : 0) + (stoppingReason ? 16 : 0);
}

function shareableLinkBonus(linkPlan: XLinkPlan) {
  return linkPlan === "body_link" ? -10 : 8;
}

function replyabilityTextBonus(text: string) {
  return text.includes("なぜ") || text.includes("気になります") || text.includes("弱いです") || text.includes("迷う") || text.includes("こっち") ? 20 : 0;
}

function replyabilityIntentBonus(intent: XGrowthIntent) {
  return intent === "AUTHORITY" ? 10 : 0;
}

function buildSocialDimensions(input: XCreativeInput, variant: XCreativeQualityVariant) {
  return {
    shareability: clamp(44 + shareableSourceBonus(input.sourceType) + shareableTextBonus(variant.text) + shareableLinkBonus(variant.linkPlan)),
    replyability: clamp(38 + replyabilityTextBonus(variant.text) + replyabilityIntentBonus(variant.intent)),
  };
}

function buildQualityDimensions(input: XCreativeInput, variant: XCreativeQualityVariant, signals: QualityScoreSignals): Record<XQualityDimension, number> {
  const attention = buildAttentionDimensions(input, variant, signals);
  const evidence = buildEvidenceDimensions(input, variant, signals.proofCount);
  const noveltyMedia = buildNoveltyMediaDimensions(input, variant, signals);
  const social = buildSocialDimensions(input, variant);
  return {
    scrollStop: attention.scrollStop,
    curiosity: attention.curiosity,
    proof: evidence.proof,
    judgment: evidence.judgment,
    followValue: evidence.followValue,
    specificity: evidence.specificity,
    novelty: noveltyMedia.novelty,
    adSmell: noveltyMedia.adSmell,
    ctaFit: noveltyMedia.ctaFit,
    mediaFit: noveltyMedia.mediaFit,
    shareability: social.shareability,
    replyability: social.replyability,
  };
}

function failedQualityDimensions(intent: XGrowthIntent, dimensions: Record<XQualityDimension, number>) {
  return QUALITY_RULES[intent]
    .filter(([key, min]) => key === "adSmell" ? dimensions.adSmell > (intent === "MONEY" ? 45 : 24) : dimensions[key] < min)
    .map(([key]) => key);
}

function calculateQualityTotal(intent: XGrowthIntent, dimensions: Record<XQualityDimension, number>) {
  return intent === "REACH"
    ? clamp(dimensions.scrollStop * 0.2 + dimensions.curiosity * 0.14 + dimensions.shareability * 0.17 + dimensions.replyability * 0.08 + dimensions.followValue * 0.09 + dimensions.mediaFit * 0.17 + dimensions.novelty * 0.12 + (100 - dimensions.adSmell) * 0.03)
    : clamp((dimensions.scrollStop + dimensions.curiosity + dimensions.proof + dimensions.judgment + dimensions.followValue + dimensions.specificity + dimensions.novelty + dimensions.ctaFit + dimensions.mediaFit + dimensions.shareability + dimensions.replyability + (100 - dimensions.adSmell)) / 12);
}

type QualityInputSignals = Pick<QualityScoreSignals, "proofCount" | "hasVerifiedVideoFact" | "reachSourceSignal" | "reachTextHook" | "firstSecondsBoost" | "mediaStoryFit" | "adSmell"> & {
  videoTag: ReturnType<typeof primaryVideoTag>;
  forbiddenHits: string[];
  temporalHits: string[];
};

type QualityHistorySignals = Pick<QualityScoreSignals, "noveltyPenalty" | "historicalWinnerBonus"> & {
  recentSimilarity: number;
  sameStructureCount: number;
};

function hasReachSourceSignal(input: XCreativeInput) {
  return input.sourceType === "MARKET" || input.sourceType === "COMPARISON" || input.sourceType === "JUDGMENT";
}

function hasReachTextHook(text: string) {
  return text.includes("今日") || text.includes("同じ") || text.includes("見送") || text.includes("偏り") || text.includes("差が") || text.includes("迷う") || text.includes("冒頭") || text.includes("ジャケ") || text.includes("動画");
}

function firstSecondsBoostFor(input: XCreativeInput, variant: XCreativeQualityVariant, videoTag: ReturnType<typeof primaryVideoTag>) {
  return variant.intent === "REACH" && variant.mediaType === "sample_movie" && videoTag === "first_seconds_strong" && input.mediaQuality === "strong" ? 28 : 0;
}

function collectQualityInputSignals(input: XCreativeInput, variant: XCreativeQualityVariant): QualityInputSignals {
  const proofCount = strongestFacts(input).length;
  const videoTag = primaryVideoTag(input);
  const hasVerifiedVideoFact = variant.mediaType === "sample_movie" && Boolean(primaryUsableVisualFact(input.visualFacts));
  const reachSourceSignal = (hasReachSourceSignal(input) ? 18 : 0) + (hasVerifiedVideoFact ? 8 : 0);
  const reachTextHook = hasReachTextHook(variant.text) ? 16 : 0;
  const firstSecondsBoost = firstSecondsBoostFor(input, variant, videoTag);
  const mediaStoryFitValue = mediaStoryFit(variant, videoTag);
  const adSmell = evaluateAdSmell(variant.text, variant.linkPlan, input);
  const forbiddenHits = FORBIDDEN_PUBLIC_WORDS.filter((word) => variant.text.includes(word));
  const temporalHits = hasRankingTrend(input) ? [] : FORBIDDEN_TEMPORAL_WORDS.filter((word) => variant.text.includes(word));
  return {
    proofCount,
    videoTag,
    hasVerifiedVideoFact,
    reachSourceSignal,
    reachTextHook,
    firstSecondsBoost,
    mediaStoryFit: mediaStoryFitValue,
    adSmell,
    forbiddenHits,
    temporalHits,
  };
}

function hasRecentQualitySignal(log: NonNullable<XCreativeInput["recentLogs"]>[number]) {
  return (log.impressions_24h ?? 0) >= 500 || (log.profile_visits_24h ?? 0) > 0 || (log.follows_24h ?? 0) > 0;
}

function collectQualityHistorySignals(input: XCreativeInput, variant: XCreativeQualityVariant): QualityHistorySignals {
  const recentLogs = input.recentLogs ?? [];
  const recentSimilarity = Math.max(0, ...recentLogs.slice(0, 12).map((log) => similarity(variant.text, log.post_text)));
  const sameStructureCount = recentLogs.slice(0, 8).filter((log) => String(log.creative_genome?.structure ?? "").includes(variant.structure)).length;
  const recentHighPerformers = recentLogs.slice(0, 60).filter(hasRecentQualitySignal);
  const winningHookType = recentHighPerformers.length > 0 ? calculateHookScore(input).bestHook.type : null;
  const historicalWinnerBonus = recentHighPerformers.some((log) => log.hook_type === winningHookType) ? 5 : 0;
  const noveltyPenalty = Math.round(recentSimilarity * 40) + sameStructureCount * 8;
  return { recentSimilarity, sameStructureCount, historicalWinnerBonus, noveltyPenalty };
}

function hasStrictCopyQualityFailure(variant: XCreativeQualityVariant, signals: QualityInputSignals, lastMile: ReturnType<typeof lastMileGate>) {
  return Boolean(signals.forbiddenHits.length || signals.temporalHits.length || variant.text.includes("…") || !lastMile.passed || !lastMile.humanVoice.passed || !lastMile.nativeXVoice.passed);
}

function buildQualityFailures(intent: XGrowthIntent, dimensions: Record<XQualityDimension, number>, variant: XCreativeQualityVariant, signals: QualityInputSignals, lastMile: ReturnType<typeof lastMileGate>) {
  const failed = failedQualityDimensions(intent, dimensions);
  if (hasStrictCopyQualityFailure(variant, signals, lastMile)) failed.push("specificity");
  return failed;
}

function qualityThreshold(intent: XGrowthIntent) {
  return intent === "MONEY" ? 68 : intent === "REACH" ? 70 : 72;
}

function passedQualityGate(intent: XGrowthIntent, variant: XCreativeQualityVariant, lastMile: ReturnType<typeof lastMileGate>, signals: QualityInputSignals, failed: XQualityDimension[], total: number) {
  return lastMile.passed && lastMile.humanVoice.passed && lastMile.nativeXVoice.passed && signals.forbiddenHits.length === 0 && signals.temporalHits.length === 0 && !variant.text.includes("…") && failed.length === 0 && total >= qualityThreshold(intent) && getXWeightedLength(variant.text) <= 280;
}

function specificityReason(variant: XCreativeQualityVariant, lastMile: ReturnType<typeof lastMileGate>, signals: QualityInputSignals) {
  if (lastMile.reasons.length) return `Last-Mile Gate: ${lastMile.reasons.join(" / ")}`;
  if (signals.forbiddenHits.length) return `投稿本文に内部語が残っています: ${signals.forbiddenHits.join(", ")}`;
  if (signals.temporalHits.length) return `履歴不足で使えない時系列表現があります: ${signals.temporalHits.join(", ")}`;
  if (variant.text.includes("…")) return "完成文に機械的な省略記号が残っています";
  return "具体的な数値と作品固有情報の量から算出";
}

function improvementForDimension(key: XQualityDimension) {
  switch (key) {
    case "adSmell": return "販促語と直リンクを弱め、データ判断を前に出す";
    case "proof": return "価格・ランキング・レビューの根拠が薄いので投稿しない候補に寄せる";
    case "novelty": return "冒頭型か構造を変えて同型連投を避ける";
    default: return `${key}を補強する`;
  }
}

function requiredQualityRules(intent: XGrowthIntent) {
  return QUALITY_RULES[intent].map(([key, min]) => key === "adSmell" ? "Ad Smellを低く保つ" : `${key} >= ${min}`);
}

export function qualityFor(input: XCreativeInput, variant: XCreativeQualityVariant) {
  const inputSignals = collectQualityInputSignals(input, variant);
  const historySignals = collectQualityHistorySignals(input, variant);
  const dimensions = buildQualityDimensions(input, variant, { ...inputSignals, ...historySignals });
  const lastMile = lastMileGate(input, variant, 0);
  const failed = buildQualityFailures(variant.intent, dimensions, variant, inputSignals, lastMile);
  const total = calculateQualityTotal(variant.intent, dimensions);
  const passed = passedQualityGate(variant.intent, variant, lastMile, inputSignals, failed, total);
  const { videoTag, adSmell } = inputSignals;
  const { recentSimilarity, sameStructureCount } = historySignals;
  return {
    dimensions,
    total,
    passed,
    recommendation: passed ? "post" as const : total >= 62 ? "revise" as const : "do_not_post" as const,
    reasons: {
      scrollStop: "ランキング、過去最安、発掘指数など冒頭に使える異常値から算出",
      curiosity: "疑問、ズレ、不自然さ、根拠の出し惜しみを文面から判定",
      proof: "価格、ランキング、レビュー、発掘指数、買い時、価格系列数から算出",
      judgment: "数字の意味づけが入っているかを文面から判定",
      followValue: "継続して追う理由、メディアとしての視点、シリーズ性から算出",
      specificity: specificityReason(variant, lastMile, inputSignals),
      novelty: `直近投稿との最大類似度${Math.round(recentSimilarity * 100)}%、同型連投${sameStructureCount}件から減点`,
      adSmell: `販促語、直リンク、セール率だけの訴求、PRタグ臭を減点。検出値${adSmell}`,
      ctaFit: "intentに対してリンクとCTAが強すぎないかを判定",
      mediaFit: variant.mediaType === "sample_movie" && videoTag ? `動画manual tag ${videoTag} と短文Hookの噛み合いを判定。REACHでは冒頭力を価格/評価より優先` : "素材種別と本文の役割が噛み合うかを判定。カードなら比較、動画なら短いHookを重視",
      shareability: "広告ではなく、他人にも見せたくなる違和感や比較があるかを判定",
      replyability: "問い、反論、補足が生まれやすい余白があるかを判定",
    },
    weaknesses: failed,
    improvements: [...lastMile.reasons, ...failed.map(improvementForDimension)],
    gate: { intent: variant.intent, passed, required: requiredQualityRules(variant.intent), failed },
    lastMile,
  };
}
