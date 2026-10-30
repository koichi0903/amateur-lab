import { getXWeightedLength } from "@/lib/xText";
import { primaryUsableVisualFact } from "@/lib/xVisualVideoFacts";
import { decisionFactProofLine } from "@/lib/domain/decisionFacts";
import { stableChoiceIndex } from "./xCreativeDeterminism";
import { humanProofLine } from "./xCreativeProof";
import { concreteVisualPhrase, videoSpecificLines } from "./xCreativeVideoCopy";
import { judgmentSourceLine } from "./xCreativeJudgment";
import type {
  XCreativeInput,
  XCreativeMedia,
  XCreativeStructure,
  XCreativeVariant,
  XCtaStrategy,
  XGrowthIntent,
  XHookDirection,
  XHookScore,
  XHookType,
  XHumanVoiceArchetype,
  XLinkPlan,
  XPostFormat,
} from "./xCreativeTypes";
import { calculateHookScore, clamp, formatText, hasRankingTrend, hookSubject, pct, primaryActress, primaryVideoTag, safeTitleFragment, strongestFacts } from "./xCreativeInputFacts";
import { containsConcreteVisualPhrase, lastMileGate, qualityFor, sanitizePublicText } from "./xCreativeQuality";
export { finalNativeXVoiceGate, validateXCopyGrammar } from "./xCreativeQuality";
export { calculateHookScore };
export type * from "./xCreativeTypes";

const INTENTS: XGrowthIntent[] = ["REACH", "FOLLOW", "AUTHORITY", "MONEY"];

type HookOpening = { direction: XHookDirection; opening: string; score: number };
type HookOpeningContext = { subject: string | null; facts: string[]; fact: string; hasTrend: boolean; actress: string | null; topic: string; moneyReason: string; genre: string | undefined; discount: string };
const VOICE_ARCHETYPE_BY_DIRECTION: Partial<Record<XHookDirection, XHumanVoiceArchetype>> = {
  confession: "spontaneous_reaction",
  missed: "spontaneous_reaction",
  surprise: "surprise_mismatch",
  contrast: "surprise_mismatch",
  social_proof: "social_proof_light",
  follow_up: "conversational",
  question: "conversational",
  curation: "quiet_recommendation",
  anti_obvious: "quiet_recommendation",
  hot_take: "changed_mind",
  comparison: "dry_observation",
  pattern_break: "dry_observation",
  empathy: "actress_fit",
};

function hookOpeningContext(input: XCreativeInput): HookOpeningContext {
  const subject = hookSubject(input);
  const facts = strongestFacts(input);
  const actress = primaryActress(input);
  return {
    subject,
    facts,
    fact: facts[0] ?? (subject ? `${subject}` : ""),
    hasTrend: hasRankingTrend(input),
    actress,
    topic: actress ? `${actress}のこれ` : safeTitleFragment(input),
    moneyReason: input.isNinetyDayLow ? "過去90日でかなり安い" : input.saleEndAt ? "セール期限が近い" : input.discountRate >= 30 ? "値下げ幅が大きい" : "サンプルで判断しやすい",
    genre: input.genre?.split(/[,、/]/)[0]?.trim(),
    discount: input.discountRate >= 30 ? `${pct(input.discountRate)}OFF` : "セール",
  };
}

function decisionAndVideoOpenings(input: XCreativeInput, intent: XGrowthIntent): HookOpening[] {
  const decisionProof = input.decisionFacts ? decisionFactProofLine(input.decisionFacts) : "";
  const videoLines = input.hasRightsCheckedMovie && input.sampleMovieUrl ? videoSpecificLines(input, intent, "no_link", "curiosity") : null;
  return [
    ...(input.decisionFacts?.decisionType === "RECORD_LOW" ? [{ direction: "curiosity" as const, opening: "発掘LABの記録上の最安値。価格履歴を先に見たいです。", score: 112 }] : []),
    ...(input.decisionFacts?.decisionType === "HIGH_DISCOUNT_NOT_LOW" ? [{ direction: "contrast" as const, opening: `${input.decisionFacts.discountRate ?? 0}%OFFでも、発掘LABの記録上の最安値ではありません。`, score: 112 }] : []),
    ...(input.decisionFacts?.decisionType === "HIDDEN_VALUE" ? [{ direction: "comparison" as const, opening: decisionProof ? `${decisionProof}。ランキングだけでは見落としやすいです。` : "ランキング外ですが、レビューと価格を先に見たいです。", score: 112 }] : []),
    ...(videoLines ? [{ direction: primaryVideoTag(input) === "visual_mismatch" ? "contrast" as const : primaryVideoTag(input) === "scene_surprise" ? "surprise" as const : "curiosity" as const, opening: videoLines[0], score: 104 }] : []),
  ];
}

function marketOpenings(context: HookOpeningContext): HookOpening[] {
  const { genre, discount } = context;
  return [
    { direction: "surprising_concentration", opening: genre ? `今日の${discount}、${genre}に当たりが寄っています。` : `今日の${discount}、数より並び方の偏りが気になります。`, score: 97 },
    { direction: "pattern_break", opening: genre ? `今日はランキング順より、${genre}の並び方で止まりました。` : "今日はランキング順より、セール欄の並び方で止まりました。", score: 95 },
    { direction: "anti_obvious", opening: "ランキングだけ見ていると、今日の当たりを外しそうです。", score: 94 },
    { direction: "curation", opening: genre ? `今見るなら、まず${genre}からでよさそうです。` : "今見るなら、まずこの並びからでよさそうです。", score: 91 },
    { direction: "selection_tension", opening: `今日の${discount}、全部見るより一回だけ引っかかりを選びたいです。`, score: 90 },
  ];
}

function comparisonOpenings(input: XCreativeInput): HookOpening[] {
  return [
    { direction: "contrast", opening: input.discountRate >= 30 ? `同じ${pct(input.discountRate)}OFFでも、サンプルを見るなら差があります。` : "似た条件でも、最初に気になる一本は変わります。", score: 97 },
    { direction: "selection_tension", opening: "3本で迷うなら、今日は最初の1本を決めてからでいいです。", score: 94 },
    { direction: "anti_obvious", opening: "安い順で見ると、たぶん選び方を外します。", score: 91 },
    { direction: "question", opening: "似た条件で並べると、意外と選び方が変わります。", score: 88 },
  ];
}

function judgmentOpenings(input: XCreativeInput): HookOpening[] {
  return [
    { direction: "hot_take", opening: input.discountRate >= 30 ? `${pct(input.discountRate)}OFFだけど、これは今日は見送っていいかもしれません。` : "売れてそうに見えても、今日は急がなくてよさそうです。", score: 95 },
    { direction: "contradiction", opening: "安さより先に、見送る理由を見ておきたい。", score: 88 },
  ];
}

function followUpOpenings(input: XCreativeInput, context: HookOpeningContext): HookOpening[] {
  const { hasTrend } = context;
  const opening = hasTrend ? `前回${input.previousRanking}位から今日${input.ranking}位。これは続報で見たい。`
    : input.seriesName ? `${input.seriesName}周辺、今日も少し気になります。` : "昨日の注目枠、もう一度だけ見ておきたい。";
  return [{ direction: "follow_up", opening, score: hasTrend ? 96 : 82 }];
}

function actressTrendOpenings(context: HookOpeningContext): HookOpening[] {
  const { actress } = context;
  return [
    { direction: "curiosity", opening: actress ? `${actress}は、こういう静かな作品の方が強く見える日があります。` : "女優軸で見ると、今日はこの候補が残ります。", score: 92 },
    { direction: "social_proof", opening: actress ? `${actress}目当てなら、評価より先に空気を見たい。` : "女優名だけで追うと、少し見方が変わります。", score: 88 },
  ];
}

function genreTrendOpenings(input: XCreativeInput): HookOpening[] {
  return [{ direction: "comparison", opening: input.genre ? `${input.genre.split(/[,、/]/)[0]}で探すなら、今日はランキング順だけで決めない方がよさそうです。` : "ジャンル軸で見ると、今日はランキング順だけでは決めにくいです。", score: 90 }];
}

function makerTrendOpenings(input: XCreativeInput): HookOpening[] {
  return [{ direction: "curiosity", opening: input.seriesName ? `${input.seriesName}周辺は、メーカーの出し方まで含めて見たいです。` : "メーカー軸で見ると、今日は少し引っかかります。", score: 86 }];
}

function priceEventOpenings(input: XCreativeInput, context: HookOpeningContext): HookOpening[] {
  return [
    { direction: "curiosity", opening: input.discountRate >= 30 ? "半額だけでなく、評価まで高いのが少し気になります。" : "今日は価格より、サンプルで刺さるかを先に見たいです。", score: 94 },
    { direction: "hot_take", opening: "安いから即決、までは言いません。", score: 88 },
    { direction: "empathy", opening: input.isNinetyDayLow ? "安いから買う、ではなく過去価格との差で止まる日です。" : `セール欄を流し見してる人ほど、${context.topic}は一回止まっていいと思います。`, score: 90 },
  ];
}

function sourceTypeOpenings(input: XCreativeInput, context: HookOpeningContext): HookOpening[] {
  switch (input.sourceType) {
    case "MARKET": return marketOpenings(context);
    case "COMPARISON": return comparisonOpenings(input);
    case "JUDGMENT": return judgmentOpenings(input);
    case "FOLLOW_UP": return followUpOpenings(input, context);
    case "ACTRESS_TREND": return actressTrendOpenings(context);
    case "GENRE_TREND": return genreTrendOpenings(input);
    case "MAKER_TREND": return makerTrendOpenings(input);
    case "PRICE_EVENT": return priceEventOpenings(input, context);
    default: return [];
  }
}

function genericOpenings(input: XCreativeInput, intent: XGrowthIntent, context: HookOpeningContext): HookOpening[] {
  const { subject, facts, fact, hasTrend, topic, moneyReason } = context;
  return [
    { direction: "missed", opening: `${topic}、最初は通りすぎてました。`, score: 78 + (input.imageUrl ? 4 : 0) },
    { direction: "curiosity", opening: `${topic}、数字より先に雰囲気で気になります。`, score: 76 + (input.reviewAverage ?? 0) * 3 },
    { direction: "contradiction", opening: fact && !fact.includes("ランキング") ? `${fact}まであるのに、押し出しは意外と静かです。` : "強く押されていないのに、妙に気になる。", score: 70 + (facts.length * 7) },
    { direction: "comparison", opening: "ランキングだけ見ていると、こういう候補を落としがちです。", score: 68 + (input.ranking && input.ranking <= 80 ? 10 : 0) },
    { direction: "social_proof", opening: input.reviewAverage ? "知らない作品でも、ここまで評価が高いと少し見方が変わります。" : "知らない作品ほど、最初のひっかかりで決めたいです。", score: 66 + Math.min(input.reviewCount, 60) / 3 },
    { direction: "confession", opening: "正直、最初は通りすぎていました。", score: 68 + (input.imageUrl ? 4 : 0) },
    { direction: "hot_take", opening: intent === "MONEY" ? `安いだけなら流しますが、これは${moneyReason}のが引っかかります。` : "売れているかより、引っかかり方の方が気になります。", score: 73 + (input.isNinetyDayLow ? 6 : 0) },
    { direction: "surprise", opening: `${topic}、思ったより静かな顔をしてます。`, score: 76 + (facts.length * 5) },
    { direction: "empathy", opening: `セール欄を流し見してる人ほど、${topic}は一回止まっていいと思います。`, score: intent === "MONEY" ? 84 : 72 },
    { direction: "question", opening: `${topic}、まだ見てない人は多そうです。`, score: 80 },
    { direction: "follow_up", opening: hasTrend ? `前回${input.previousRanking}位から今日${input.ranking}位。これは続報で見たい。` : subject ? `${subject}周辺は、もう少し追っていい気がします。` : "これは次も追っていい。", score: hasTrend ? 92 : 50 },
  ];
}

function hookOpenings(input: XCreativeInput, intent: XGrowthIntent): HookOpening[] {
  const context = hookOpeningContext(input);
  const openings = [
    ...decisionAndVideoOpenings(input, intent),
    ...sourceTypeOpenings(input, context),
    ...genericOpenings(input, intent, context),
  ];
  return openings.sort((a, b) => b.score - a.score).slice(0, 6);
}

function hookLine(input: XCreativeInput, intent: XGrowthIntent, direction: XHookDirection) {
  const subject = input.seriesName ?? input.actress?.split(/[,、/]/)[0]?.trim() ?? input.genre?.split(/[,、/]/)[0]?.trim();
  const opening = hookOpenings(input, intent).find((item) => item.direction === direction)?.opening;
  if (opening) return opening;
  if (intent === "FOLLOW") return subject ? `${subject}周辺は、もう少し追っていい気がします。` : "こういう候補を毎日拾うためのメモです。";
  if (intent === "AUTHORITY") return "ランキングだけ見ていると、こういう候補を落としがちです。";
  return input.isNinetyDayLow ? "安いから買う、ではまだ弱いです。" : "クリック前に、見る理由だけ先に確認します。";
}

function voiceProof(input: XCreativeInput, intent: XGrowthIntent, direction: XHookDirection) {
  // A lived-in X reaction does not need a stat on every post.
  // Numeric proof is reserved for the archetypes that actually make a proof
  // the point of the post. This keeps metadata fallback from becoming a
  // mandatory rating/price footer on every Human Voice variant.
  if (intent !== "MONEY" && !["social_proof", "hot_take"].includes(direction)) return "";
  if (["missed", "confession", "surprise", "empathy", "question"].includes(direction)) return "";
  return humanProofLine(input, intent);
}

export function voiceArchetype(direction: XHookDirection, index: number): XHumanVoiceArchetype {
  const directionArchetype = VOICE_ARCHETYPE_BY_DIRECTION[direction];
  if (directionArchetype) return directionArchetype;
  if (index % 3 === 0) return "hidden_find";
  if (index % 3 === 1) return "price_reason";
  return "spontaneous_reaction";
}

function decisionJudgmentLine(input: XCreativeInput) {
  switch (input.decisionFacts?.decisionType) {
    case "HIGH_DISCOUNT_NOT_LOW": return "割引率だけで急がず、記録最安との差を見て決めたいです。";
    case "HIDDEN_VALUE": return "ランキングだけで決めず、評価と価格を見てから判断したいです。";
    case "RECORD_LOW": return "最安値の記録は確認できますが、合うかはサンプルまで見て決めたいです。";
    default: return null;
  }
}

function intentJudgmentLine(input: XCreativeInput, intent: XGrowthIntent) {
  if (intent === "REACH") return input.hasRightsCheckedMovie ? "動画で一瞬止められるなら、今日はこの形が一番自然です。" : "派手に煽るより、違和感だけ置いた方が読まれそうです。";
  if (intent === "FOLLOW") return "タイトルより中身寄りで見る方が合っています。";
  if (intent === "AUTHORITY") {
    if (input.ranking && input.ranking <= 80 && input.reviewAverage) return "数字を少し添えるだけで、流すには惜しい理由が出ます。";
    return input.reviewAverage ? "サンプルの方が強いかどうか、そこまで見たい。" : "評価と価格を分けて見ると、選びやすい。";
  }
  if (intent === "CONVERSATION") return "外の投稿に乗るなら、断定より一つだけ事実を添える方がよさそうです。";
  return input.discountRate >= 30 || input.isNinetyDayLow ? "気になっていたなら、価格とサンプルを見て決めていい日です。" : "急がず、他の一本と比べてからでよさそうです。";
}

function judgmentLine(input: XCreativeInput, intent: XGrowthIntent) {
  return decisionJudgmentLine(input) ?? judgmentSourceLine(input) ?? intentJudgmentLine(input, intent);
}

function moneyClickReason(input: XCreativeInput) {
  if (input.isNinetyDayLow) return "気になってた人は、今日はサンプルまで見てから決めていいと思います。";
  if (input.saleEndAt) return "迷っていた人は、期限だけ先に見ておくと判断しやすいです。";
  if (input.discountRate >= 30) return "値段だけで決めず、サンプルで刺さるか確認するくらいがちょうどいいです。";
  return "急がず、他の一本と比べてからでよさそうです。";
}

function intentMediaFor(intent: XGrowthIntent): XCreativeMedia | null {
  if (intent === "MONEY") return "existing_link_image";
  if (intent === "CONVERSATION") return "quote";
  return null;
}

function qualityFallbackMediaFor(input: XCreativeInput): XCreativeMedia | null {
  const tags = input.mediaManualTags ?? [];
  if (tags.includes("too_explicit_for_reach") || tags.includes("weak_visual") || input.mediaQuality === "weak") {
    return input.imageUrl ? "existing_link_image" : "text";
  }
  return null;
}

function mediaFor(input: XCreativeInput, intent: XGrowthIntent): XCreativeMedia {
  const intentMedia = intentMediaFor(intent);
  if (intentMedia) return intentMedia;
  if (input.imageUrl && input.sourceType === "PRICE_EVENT") return "data_card";
  const qualityFallback = qualityFallbackMediaFor(input);
  if (qualityFallback) return qualityFallback;
  if (input.hasRightsCheckedMovie && input.sampleMovieUrl && ["REACH", "FOLLOW", "AUTHORITY"].includes(intent)) return "sample_movie";
  // A work image remains the fallback for market, comparison, judgment, and other topics.
  return input.imageUrl ? "existing_link_image" : "text";
}

function variantPlan(intent: XGrowthIntent): { structure: XCreativeStructure; linkPlan: XLinkPlan; cta: XCtaStrategy } {
  if (intent === "REACH") return { structure: "short", linkPlan: "no_link", cta: "reason_cta" };
  if (intent === "FOLLOW") return { structure: "follow_up", linkPlan: "profile_only", cta: "reason_cta" };
  if (intent === "AUTHORITY") return { structure: "judgment", linkPlan: "no_link", cta: "reason_cta" };
  if (intent === "CONVERSATION") return { structure: "question", linkPlan: "no_link", cta: "reason_cta" };
  return { structure: "data", linkPlan: "body_link", cta: "price_cta" };
}

function buildBody(input: XCreativeInput, intent: XGrowthIntent, structure: XCreativeStructure, linkPlan: XLinkPlan, direction: XHookDirection) {
  const proofLine = voiceProof(input, intent, direction);
  const judgment = intent === "MONEY" ? moneyClickReason(input) : judgmentLine(input, intent);
  const lines = [
    hookLine(input, intent, direction),
    proofLine,
    input.title.length <= 42 ? "__TITLE__" : "",
    judgment,
  ].filter(Boolean);
    if (input.sourceType === "COMPARISON" && input.genre) lines.splice(1, 0, `${input.genre.split(/[,、/]/)[0]}で迷う人は、先に雰囲気が合う方からでよさそうです。`);
  if (intent === "FOLLOW" && !proofLine) lines.push("こういう候補を、毎日ひとつずつ拾っています。");
  if (linkPlan === "body_link") lines.push(input.url);
  return sanitizePublicText(formatText(lines, input.title));
}

type LastMileBodyContext = {
  input: XCreativeInput;
  intent: XGrowthIntent;
  linkPlan: XLinkPlan;
  direction: XHookDirection;
  topic: string;
  naturalTopic: string;
  proof: string;
  proofSentence: string;
  link: string;
  moneyReason: string;
  reachReason: string;
  videoLines: ReturnType<typeof videoSpecificLines> | null;
};

function finalizeLastMileBodies(context: LastMileBodyContext, texts: string[]) {
  return texts.map((text, index) => {
    const withFactlessAction = ensureFactlessReaderAction(context.input, context.intent, context.direction, text);
    return diversifyNativeStructure(context.input, context.intent, context.direction, withFactlessAction, index);
  });
}

function uniqueLastMileBodies(context: LastMileBodyContext, texts: string[]) {
  return finalizeLastMileBodies(context, [...new Set(texts.map(sanitizePublicText))]);
}

function buildPriceEventBodies(context: LastMileBodyContext) {
  const { input, intent, linkPlan, direction, proof, proofSentence, link } = context;
  return uniqueLastMileBodies(context, [
    buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    formatText([input.discountRate >= 30 ? "半額だけでなく、評価まで高いのが少し気になります。" : "今日は価格より、サンプルで刺さるかを先に見たいです。", proofSentence || proof, "気になっていた人は、今日はサンプルまで。", link].filter(Boolean), input.title),
    formatText(["安いから即決、までは言いません。", proof, "でもサンプルで刺さるなら、今日は見ておきたい。", link].filter(Boolean), input.title),
  ]);
}

function buildSampleMovieBodies(context: LastMileBodyContext) {
  const { input, intent, linkPlan, direction, topic, proof } = context;
  const actress = primaryActress(input);
  return uniqueLastMileBodies(context, [
    buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    formatText([`${topic}、最初は通りすぎてました。`, proof || "", "動画で見た方が早い。"].filter(Boolean), input.title),
    formatText([actress ? `${actress}でこれ、少し見落としてました。` : `${topic}、少し見落としてました。`, proof || "", "今日は動画だけで止めます。"].filter(Boolean), input.title),
    formatText([`${topic}、派手に煽るよりそのまま見た方が早い。`, proof || "", "今日はこれだけ見ておきたい。"].filter(Boolean), input.title),
  ]);
}

function buildMarketBodies(context: LastMileBodyContext) {
  const { input, intent, linkPlan, direction, proof } = context;
  const genre = input.genre?.split(/[,、/]/)[0]?.trim();
  const discount = input.discountRate >= 30 ? `${pct(input.discountRate)}OFF` : "セール";
  return uniqueLastMileBodies(context, [
    buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    formatText([genre ? `今日の${discount}、${genre}に当たりが寄っています。` : `今日の${discount}、数より並び方の偏りが気になります。`, "一覧を流す前に、一回止まる理由だけ残せば十分です。"].filter(Boolean), input.title),
    formatText(["ランキングだけ見ていると、今日の当たりを外しそうです。", proof, "全部見るより、引っかかった一本だけでいい日。"].filter(Boolean), input.title),
    formatText([genre ? `今日はランキング順より、${genre}の並び方で止まりました。` : "今日はランキング順より、セール欄の並び方で止まりました。", "数字なしでも、並べると空気の違いは分かります。", "雰囲気が合う一本だけ拾えばいい日です。"].filter(Boolean), input.title),
  ]);
}

function buildComparisonBodies(context: LastMileBodyContext) {
  const { input, intent, linkPlan, direction, proof } = context;
  return uniqueLastMileBodies(context, [
    buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    formatText([input.discountRate >= 30 ? `同じ${pct(input.discountRate)}OFFでも、サンプルを見るなら差があります。` : "似た条件でも、最初に気になる一本は変わります。", proof, "迷ったら安さより、雰囲気が合う方から見たいです。"].filter(Boolean), input.title),
    formatText(["3本で迷うなら、今日は最初の1本を決めてからでいいです。", "安さで並べても、最後は見たい空気がある方に寄ります。"].filter(Boolean), input.title),
  ]);
}

function buildJudgmentBodies(context: LastMileBodyContext) {
  const { input, intent, linkPlan, direction, proof } = context;
  return uniqueLastMileBodies(context, [
    buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    formatText([input.discountRate >= 30 ? `${pct(input.discountRate)}OFFだけど、これは今日は見送っていいかもしれません。` : "売れてそうに見えても、今日は急がなくてよさそうです。", proof, "安さより、刺さる理由が弱い方が気になります。"].filter(Boolean), input.title),
  ]);
}

function buildGeneralLastMileBodies(context: LastMileBodyContext) {
  const { input, intent, linkPlan, direction, naturalTopic, proofSentence, moneyReason, reachReason, topic, proof } = context;
  const bodies = [
    buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    formatText([`${naturalTopic}、最初は見落としてました。`, proofSentence, intent === "MONEY" ? moneyReason : judgmentLine(input, intent), context.link].filter(Boolean), input.title),
    formatText([`${topic}は、表紙より中身を先に見たい。`, proof, intent === "MONEY" ? moneyReason : reachReason, context.link].filter(Boolean), input.title),
    formatText([`${topic}、流し見で終わらせるには少し惜しい。`, proof, intent === "MONEY" ? moneyReason : "派手に押さなくても、この違和感だけ残る。", context.link].filter(Boolean), input.title),
    formatText([`${topic}、まだ知らない人の方が多そう。`, proof, intent === "MONEY" ? moneyReason : "知らないまま流すには、少しもったいない。", context.link].filter(Boolean), input.title),
  ];
  return uniqueLastMileBodies(context, bodies);
}

function buildLastMileBodies(input: XCreativeInput, intent: XGrowthIntent, linkPlan: XLinkPlan, direction: XHookDirection) {
  const actress = primaryActress(input);
  const proof = voiceProof(input, intent, direction);
  const context: LastMileBodyContext = {
    input,
    intent,
    linkPlan,
    direction,
    topic: actress ? `${actress}のこれ` : safeTitleFragment(input),
    naturalTopic: actress ? `${actress}でこれ` : safeTitleFragment(input),
    proof,
    proofSentence: proof ? proof.startsWith("評価") ? `でも${proof}。` : `${proof}です。` : "",
    link: linkPlan === "body_link" ? input.url : "",
    moneyReason: moneyClickReason(input),
    reachReason: input.imageUrl ? "ジャケだけだと少し流してた。" : "知らなかった人でも、サンプルからなら入りやすい。",
    videoLines: input.hasRightsCheckedMovie && input.sampleMovieUrl ? videoSpecificLines(input, intent, linkPlan, direction) : null,
  };
  if (context.videoLines) return finalizeLastMileBodies(context, [formatText(context.videoLines, input.title)].map(sanitizePublicText));
  if (input.sourceType === "PRICE_EVENT") return buildPriceEventBodies(context);
  if (input.hasRightsCheckedMovie && input.sampleMovieUrl && intent !== "MONEY") return buildSampleMovieBodies(context);
  if (input.sourceType === "MARKET") return buildMarketBodies(context);
  if (input.sourceType === "COMPARISON") return buildComparisonBodies(context);
  if (input.sourceType === "JUDGMENT") return buildJudgmentBodies(context);
  return buildGeneralLastMileBodies(context);
}

function ensureFactlessReaderAction(input: XCreativeInput, intent: XGrowthIntent, direction: XHookDirection, text: string) {
  const hasReaderAction = /見る|見て|迷|決め|止ま|流|拾|比べ|買|見送|気にな|刺さ|引っかか|伝わ/.test(text);
  if (hasReaderAction || primaryUsableVisualFact(input.visualFacts)) return text;
  const choicesByIntent: Record<XGrowthIntent, string[]> = {
    REACH: ["もう少し見てから、合うか決めたい。", "流さず、続きまで見て確かめたい。", "気になったら、先まで見ておきたい。"],
    FOLLOW: ["もう一度見て、次も追うか決めたい。", "このまま流さず、続きも見ておきたい。", "気になるところを、もう少し追ってみたい。"],
    AUTHORITY: ["急いで決めず、もう少し見てから判断したい。", "数字だけで決めず、続きまで見て確かめたい。", "気になる点を、もう一度見てから考えたい。"],
    CONVERSATION: ["気になったら、どこが残ったか聞いてみたい。", "もう少し見て、みんなの感想も聞きたい。", "この印象が合うか、見た人に聞いてみたい。"],
    MONEY: ["急いで決めず、もう少し見てから選びたい。", "価格だけで決めず、続きまで見て確かめたい。", "気になったら、見てから決めるくらいでいい。"],
  };
  const choices = choicesByIntent[intent];
  const key = [input.key, input.title, input.sourceType ?? "WORK", intent, direction].join("|");
  return `${text}\n${choices[stableChoiceIndex(key, choices.length)]}`;
}

function diversifyNativeStructure(input: XCreativeInput, intent: XGrowthIntent, direction: XHookDirection, text: string, index: number) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  // Decision Facts are attached once at the final top-pick boundary. Keeping
  // the full numeric proof in this fallback video body as well makes the
  // quality/Native-X gates judge duplicated evidence instead of the video
  // hook. Use a non-Decision-Facts evidence line for the variant itself.
  const decisionProof = input.decisionFacts ? decisionFactProofLine(input.decisionFacts) : "";
  const proof = input.decisionFacts
    ? strongestFacts(input).find((fact) => fact !== decisionProof) ?? ""
    : humanProofLine(input, intent);
  if (!proof || lines.length !== 2 || lines.some((line) => line.includes(proof))) return text;
  const key = [input.key, input.title, input.sourceType ?? "WORK", intent, direction, index, proof].join("|");
  if (stableChoiceIndex(key, 3) !== 0) return text;
  const proofReactions = [`${proof}が目に入って、少し気になった。`, `${proof}も見たうえで、サンプルを見たい。`, `${proof}だけで決めず、続きも見てから考えたい。`];
  const proofReaction = proofReactions[stableChoiceIndex(`${key}:reaction`, proofReactions.length)];
  return formatText([lines[0], proofReaction, lines[1]], input.title);
}

function chooseFormat(input: XCreativeInput, hook: XHookType): XPostFormat {
  if (input.category === "actress_best") return "actress";
  if (["genre_best", "maker_best", "series_best"].includes(input.category)) return "comparison";
  if (hook === "buy_timing" || hook === "price_anomaly") return "buy_timing";
  if (hook === "rating_anomaly") return "rating_anomaly";
  if (hook === "review_proof") return "social_proof";
  return "discovery";
}

function buildCreativeVariantForAlternative(input: XCreativeInput, hookScore: XHookScore, intent: XGrowthIntent, plan: ReturnType<typeof variantPlan>, mediaType: XCreativeMedia, alternatives: HookOpening[], alternative: HookOpening, alternativeIndex: number): XCreativeVariant {
  const linkPlan = intent === "MONEY" && alternativeIndex === 4 ? "reply_link" as const : plan.linkPlan;
  const reviewedCandidates = buildLastMileBodies(input, intent, linkPlan, alternative.direction)
    .map((text, index) => ({
      text,
      quality: qualityFor(input, { intent, structure: plan.structure, mediaType, linkPlan, text }),
      rewriteCount: index,
    }));
  // Keep A/B/C materially different when the same source produces several
  // valid bodies. The preferred index is stable, while failed variants still
  // fall back to the strongest passing body.
  const preferred = reviewedCandidates[alternativeIndex % Math.max(1, reviewedCandidates.length)];
  const primaryVideoFact = mediaType === "sample_movie" ? primaryUsableVisualFact(input.visualFacts) : null;
  const factPhrase = primaryVideoFact ? concreteVisualPhrase(primaryVideoFact, [input.key, intent, alternative.direction].join("|")) : "";
  const factPreserving = factPhrase && primaryVideoFact
    ? reviewedCandidates.find((candidate) => candidate.quality.passed && containsConcreteVisualPhrase(candidate.text, primaryVideoFact))
    : undefined;
  const reviewed = factPreserving
    ?? (preferred?.quality.passed
      ? preferred
      : reviewedCandidates.sort((a, b) => Number(b.quality.passed) - Number(a.quality.passed) || b.quality.total - a.quality.total)[0]);
  const text = reviewed.text;
  const quality = {
    ...reviewed.quality,
    lastMile: { ...lastMileGate(input, { intent, mediaType, linkPlan, text }, reviewed.rewriteCount), rewriteCount: reviewed.rewriteCount },
  };
  const length = getXWeightedLength(text);
  const proof = strongestFacts(input).join(" / ") || "story_only";
  const buzzPotential = buildBuzzPotential(quality, intent, mediaType, alternative.direction);
  return {
    id: `${input.key}-${intent.toLowerCase()}-${plan.structure}-${alternative.direction}-${alternativeIndex}`,
    intent,
    postFormat: chooseFormat(input, hookScore.bestHook.type),
    hookType: hookScore.bestHook.type,
    structure: plan.structure,
    mediaType,
    // Cards are not part of the X Growth media policy. Video and real work
    // images both use the original work-media strategy label.
    imageStrategy: "original_work_image",
    linkStrategy: linkPlan === "body_link" ? "body_link" : "reply_link",
    linkPlan,
    ctaStrategy: plan.cta,
    bodyText: text,
    replyText: linkPlan === "reply_link" ? formatText(["必要な時だけ確認用です。", input.url], input.title) : null,
    url: input.url,
    rationale: `${hookScore.bestHook.label}: ${hookScore.bestHook.evidence} / ${intent}向け`,
    weightedLength: length,
    quality,
    buzzPotential,
    hookDirection: alternative.direction,
    archetype: voiceArchetype(alternative.direction, alternativeIndex),
    hookAlternatives: alternatives,
    creativeGenome: {
      topic: input.category,
      intent,
      hook: hookScore.bestHook.type,
      proof,
      structure: plan.structure,
      emotion: intent === "MONEY" ? "confidence" : "curiosity",
      length: length <= 150 ? "short" : "medium",
      media: mediaType,
      cta: plan.cta,
      linkStrategy: plan.linkPlan,
      postingSlot: input.recommendedSlot ?? "mixed",
    },
  };
}

function buildBuzzPotential(quality: XCreativeVariant["quality"], intent: XGrowthIntent, mediaType: XCreativeMedia, direction: XHookDirection) {
  const dimensions = quality.dimensions;
  const total = intent === "REACH"
    ? clamp(dimensions.scrollStop * 0.24 + dimensions.shareability * 0.2 + dimensions.mediaFit * 0.2 + dimensions.curiosity * 0.14 + dimensions.novelty * 0.12 + dimensions.replyability * 0.1)
    : clamp(dimensions.scrollStop * 0.18 + dimensions.shareability * 0.16 + dimensions.replyability * 0.14 + dimensions.followValue * 0.18 + dimensions.mediaFit * 0.16 + dimensions.curiosity * 0.1 + dimensions.novelty * 0.08);
  return {
    total,
    scrollStop: dimensions.scrollStop,
    shareability: dimensions.shareability,
    replyability: dimensions.replyability,
    followValue: dimensions.followValue,
    mediaFit: dimensions.mediaFit,
    curiosity: dimensions.curiosity,
    novelty: dimensions.novelty,
    reason: mediaType === "sample_movie" ? "動画で止まりやすい"
      : direction === "contradiction" ? "一目で違和感が伝わる"
        : direction === "follow_up" ? "続報として会話が生まれやすい"
          : direction === "comparison" ? "比較で読まれやすい"
            : "自然なひっかかりで止める",
  };
}

function creativeVariantsForIntent(input: XCreativeInput, hookScore: XHookScore, intent: XGrowthIntent) {
  const plan = variantPlan(intent);
  const mediaType = mediaFor(input, intent);
  const alternatives = hookOpenings(input, intent);
  return alternatives.slice(0, 5).map((alternative, index) => buildCreativeVariantForAlternative(input, hookScore, intent, plan, mediaType, alternatives, alternative, index));
}

export function buildXCreativeVariants(input: XCreativeInput, hookScore = calculateHookScore(input)): XCreativeVariant[] {
  const intents = input.radarAvailable ? [...INTENTS, "CONVERSATION" as const] : INTENTS;
  return intents.flatMap((intent) => creativeVariantsForIntent(input, hookScore, intent))
    .sort((a, b) => Number(b.quality.passed) - Number(a.quality.passed) || b.quality.total - a.quality.total);
}
