import { dataStoryScore, inferAngle, inferAudience, shortTitle } from "@/lib/myfansCreativePlan";
import { completeSourcePhrase, compactSourceText, hasBrowserVisibleVisual, hasVerifiedVisualAnalysis, visualAnalysisForQuote, visualRenderStatus } from "@/lib/myfansCreativeEvidence";
import { creatorKeyFromProduct, daysSinceIso, quoteUrlFromCandidate, recentUsedCreatorKeys, recentUsedProductIds, sourceValueForQuote, usedQuoteUrls } from "@/lib/myfansQuotePool";
import { discoveryInsightFromTopic } from "@/lib/myfansTopicValue";
import { publicCopyFactsFor } from "@/lib/myfansPublicCopyFacts";
import { roleFor } from "@/lib/myfansCopyHelpers";
import { buildPublicCopyV8, buildPublicCopyV10 } from "@/lib/myfansPublicCopyGeneration";
import { stableHash } from "@/lib/myfansHash";
import { getXWeightedLength } from "@/lib/xText";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import type { MyfansTopicValue } from "@/lib/myfansQuotePool";
import type { MyfansCreativeStrategy, MyfansLinkStrategy } from "./myfansGrowthStrategy";
import type { AudienceIntent, HookType, VisualUnderstanding } from "./myfansXExecution";

export function audienceIntentFor(postType: string, product: MyfansProduct): AudienceIntent {
  if (postType === "reply_link_sales" || postType === "body_link_sales") return "purchase_intent";
  if (postType === "profile_cta" || postType === "winner_reuse") return "returning_follower";
  if (postType === "ranking_note" || postType === "comparison_review") return "comparison_shopper";
  if (product.myfans_creators?.display_name || product.creator_x_url) return "creator_interest";
  return product.genre ? "category_interest" : "broad_curiosity";
}

type HookIntelligenceResult = { hook: HookType; evidence: Record<string, unknown>; label: string };

function strongVisualHook(quote: MyfansQuoteCandidate | null): HookIntelligenceResult | null {
  if (!hasBrowserVisibleVisual(quote)) return null;
  const visibleQuote = quote as MyfansQuoteCandidate;
  return {
    hook: "STRONG_VISUAL",
    label: "ブラウザ表示済みvisual",
    evidence: {
      x_post_url: visibleQuote.x_post_url,
      media_type: visibleQuote.media_type,
      media_permalink: visibleQuote.media_permalink,
      visual_render_status: visualRenderStatus(visibleQuote),
      verified: true,
    },
  };
}

function socialProofHook(quote: MyfansQuoteCandidate | null): HookIntelligenceResult | null {
  if (!((quote?.views ?? 0) >= 50_000 || (quote?.likes ?? 0) >= 1000 || (quote?.reposts ?? 0) >= 100)) return null;
  return {
    hook: "SOCIAL_PROOF",
    label: "反応の強いcreator投稿",
    evidence: { views: quote?.views, likes: quote?.likes, reposts: quote?.reposts, x_post_url: quote?.x_post_url },
  };
}

function newcomerHook(product: MyfansProduct): HookIntelligenceResult | null {
  if (!product.is_new || !(product.likes_count >= 50 || product.saves_count >= 20 || (product.popularity_rank ?? 999) <= 10)) return null;
  return {
    hook: "NEWCOMER",
    label: "新着なのに反応あり",
    evidence: {
      is_new: product.is_new,
      likes_count: product.likes_count,
      saves_count: product.saves_count,
      popularity_rank: product.popularity_rank,
    },
  };
}

function rankingSurgeHook(product: MyfansProduct): HookIntelligenceResult | null {
  if (!(product.popularity_rank && product.popularity_rank <= 10)) return null;
  return { hook: "RANKING_SURGE", label: "ランキング上位", evidence: { popularity_rank: product.popularity_rank } };
}

function dataAnomalyHook(product: MyfansProduct): HookIntelligenceResult | null {
  if (product.saves_count < Math.max(20, product.likes_count * 0.35)) return null;
  return {
    hook: "DATA_ANOMALY",
    label: "保存が目立つ",
    evidence: { saves_count: product.saves_count, likes_count: product.likes_count },
  };
}

function scarcityDeadlineHook(product: MyfansProduct): HookIntelligenceResult | null {
  const text = `${product.title} ${product.genre} ${product.selection_reason}`.toLowerCase();
  if (!/割引|sale|セール|削除|限定|明日まで|今日まで/.test(text)) return null;
  return { hook: "SCARCITY_DEADLINE", label: "期限・限定の根拠あり", evidence: { source: "title/genre/selection_reason" } };
}

function priceAnomalyHook(product: MyfansProduct): HookIntelligenceResult | null {
  if (!(product.price > 0 && product.price <= 1500 && product.estimated_reward > 0)) return null;
  return {
    hook: "PRICE_ANOMALY",
    label: "低価格かつ報酬条件あり",
    evidence: { price: product.price, estimated_reward: product.estimated_reward },
  };
}

function comparisonHook(product: MyfansProduct): HookIntelligenceResult {
  return {
    hook: "COMPARISON",
    label: "比較材料あり",
    evidence: {
      price: product.price,
      popularity_rank: product.popularity_rank,
      likes_count: product.likes_count,
      saves_count: product.saves_count,
    },
  };
}

export function hookIntelligence(product: MyfansProduct, quote: MyfansQuoteCandidate | null): HookIntelligenceResult {
  return strongVisualHook(quote)
    ?? socialProofHook(quote)
    ?? newcomerHook(product)
    ?? rankingSurgeHook(product)
    ?? dataAnomalyHook(product)
    ?? scarcityDeadlineHook(product)
    ?? priceAnomalyHook(product)
    ?? comparisonHook(product);
}

function attentionFreshnessFor(quote: MyfansQuoteCandidate | null) {
  return quote ? Math.max(0, 18 - Math.round(daysSinceIso(quote.collected_at) ?? 18)) : 0;
}

function attentionCooldownPenalties(
  product: MyfansProduct,
  quote: MyfansQuoteCandidate | null,
  analytics: MyfansAnalytics,
) {
  const creatorPenalty = recentUsedCreatorKeys(analytics).has(creatorKeyFromProduct(product)) ? 14 : 0;
  const productPenalty = recentUsedProductIds(analytics, 3).has(product.id) ? 24 : 0;
  const quotePenalty = quote?.last_used_at || (quote && usedQuoteUrls(analytics).has(quoteUrlFromCandidate(quote))) ? 30 : 0;
  return { creatorPenalty, productPenalty, quotePenalty };
}

function attentionEngagementFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null) {
  return Math.min(
    24,
    Math.round(((quote?.likes ?? product.likes_count) + (quote?.reposts ?? 0) * 3 + (quote?.replies ?? 0) * 2) / 30),
  );
}

function attentionVisualStrength(
  quote: MyfansQuoteCandidate | null,
  verifiedVisual: boolean,
  verifiedVisualAnalysis: boolean,
) {
  return verifiedVisualAnalysis ? 34 : verifiedVisual ? 24 : quote?.has_image || quote?.has_video ? 6 : 0;
}

function attentionReasons(
  quote: MyfansQuoteCandidate | null,
  verifiedVisual: boolean,
  verifiedVisualAnalysis: boolean,
  dataStory: ReturnType<typeof dataStoryScore>,
  penalties: ReturnType<typeof attentionCooldownPenalties>,
) {
  return [
    verifiedVisualAnalysis ? `visual-understanding-v2 verified ${quote?.media_type}` : verifiedVisual ? `browser visible ${quote?.media_type}` : "verified visualなし",
    ...dataStory.reasons.slice(0, 3),
    penalties.creatorPenalty ? "creator cooldown" : "",
    penalties.productPenalty ? "product cooldown" : "",
    penalties.quotePenalty ? "quote reuse禁止" : "",
  ].filter(Boolean);
}

export function attentionScoreFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, analytics: MyfansAnalytics) {
  const quoteFreshness = attentionFreshnessFor(quote);
  const verifiedVisual = hasBrowserVisibleVisual(quote);
  const verifiedVisualAnalysis = hasVerifiedVisualAnalysis(quote);
  const dataStory = dataStoryScore(product);
  const penalties = attentionCooldownPenalties(product, quote, analytics);
  const engagement = attentionEngagementFor(product, quote);
  const visual = attentionVisualStrength(quote, verifiedVisual, verifiedVisualAnalysis);
  const score = Math.max(
    0,
    Math.min(100, visual + quoteFreshness + engagement + Math.round(dataStory.score * 0.35)
      - penalties.creatorPenalty - penalties.productPenalty - penalties.quotePenalty),
  );
  return {
    score,
    visualStrength: visual,
    visualVerified: Boolean(verifiedVisual),
    visualAnalysisVerified: Boolean(verifiedVisualAnalysis),
    freshness: quoteFreshness,
    engagementStrength: engagement,
    dataStoryScore: dataStory.score,
    penalties: {
      creatorCooldown: penalties.creatorPenalty,
      productCooldown: penalties.productPenalty,
      quoteUsed: penalties.quotePenalty,
    },
    reasons: attentionReasons(quote, verifiedVisual, verifiedVisualAnalysis, dataStory, penalties),
  };
}

export function sourceSpecificityScore(body: string, quote: MyfansQuoteCandidate | null, understanding: VisualUnderstanding | null) {
  const sourceText = compactSourceText(quote?.text_excerpt ?? "", 80);
  const sourceTokens = sourceText
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  const visualCue = understanding?.attentionMoment || understanding?.humanObservation || understanding?.concreteVisualCue || "";
  const cueTokens = visualCue
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  const compactBody = body.replace(/[^\p{L}\p{N}]+/gu, "");
  const tokenHits = [...sourceTokens, ...cueTokens].filter((token) => compactBody.includes(token.replace(/\s+/g, ""))).length;
  const properSource = /【[^】]+】|#[^\s#]+|@[A-Za-z0-9_]+|[A-Za-z0-9]{4,}|[一-龠ぁ-んァ-ヶー]{4,}/.test(body);
  const visualSpecific = /(制服|階段|海辺|砂浜|赤|黒|ベッド|距離|くま|踊|引き|近め|表情|目線|衣装|ポーズ|字幕|テロップ|タイトル|設定)/.test(body);
  return Math.min(100, tokenHits * 24 + (properSource ? 20 : 0) + (visualSpecific ? 24 : 0) + (quote?.source_x_handle && body.includes(quote.source_x_handle) ? 16 : 0));
}

export function readerValueFor(postType: string, product: MyfansProduct) {
  const audience = inferAudience(product);
  if (postType === "ranking_note") return `${audience}が、価格や反応数を比較材料にできる。`;
  if (postType === "profile_cta" || postType === "comparison_review") return `${audience}が、自分向きか先に切り分けられる。`;
  if (postType === "reply_link_sales" || postType === "body_link_sales") return `${audience}が、リンク前に見る理由だけ確認できる。`;
  return `${audience}が、流す前に気になる点を一つ持ち帰れる。`;
}

function quoteMediaLabels(quote: MyfansQuoteCandidate) {
  const media = quote.has_video ? "動画" : quote.has_image ? "画像" : "投稿";
  const subject = media === "動画" ? "この動画" : media === "画像" ? "この画像" : "この投稿";
  return { media, subject };
}

function groundedQuoteDiscoveryLine(quote: MyfansQuoteCandidate, excerpt: string) {
  const groundedSource = sourceValueForQuote(quote).verdict === "PASS"
    ? (excerpt || compactSourceText(quote.text_excerpt ?? "", 34))
    : "";
  return groundedSource ? `「${groundedSource}」の出し方が気になってしまう。` : "";
}

function quoteDiscoveryLineOptions(input: {
  topicValue: MyfansTopicValue | null;
  media: string;
  subject: string;
  excerpt: string;
}) {
  const { topicValue, media, subject, excerpt } = input;
  return [
    `${subject}、最初の置き方がうまい。`,
    `${subject}、タイムラインで見たら一回開く。`,
    `${media}だけで見せ切る感じ、けっこうずるい。`,
    excerpt ? `「${excerpt}」の出し方が気になってしまう。` : "",
    topicValue?.reasonToCare === "conversation_worthy" ? `${subject}、短いのに妙に引っかかる。` : "",
  ].filter(Boolean);
}

function selectQuoteDiscoveryVariant(lines: string[], quoteUrl: string, variant: number) {
  return lines[(variant + stableHash(quoteUrl)) % lines.length] ?? "";
}

function quotePublicDiscoveryLine(quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null, variant = 0) {
  if (!quote) return "";
  if (visualAnalysisForQuote(quote)?.status === "verified") return "";
  const { media, subject } = quoteMediaLabels(quote);
  const excerpt = completeSourcePhrase(quote.text_excerpt ?? "", 34);
  const groundedLine = groundedQuoteDiscoveryLine(quote, excerpt);
  if (groundedLine) return groundedLine;
  const lines = quoteDiscoveryLineOptions({ topicValue, media, subject, excerpt });
  return selectQuoteDiscoveryVariant(lines, quote.x_post_url, variant);
}

function buildDiscoveryCopy(product: MyfansProduct, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null, variant = 0) {
  const insight = topicValue?.verdict === "PASS" ? discoveryInsightFromTopic(topicValue) : null;
  if (!insight) return ["話す価値の根拠が弱いので今日は出さない。"];
  const safeQuoteLine = quotePublicDiscoveryLine(quote, topicValue, variant);
  const firstLine = safeQuoteLine || insight.line;
  const closers = safeQuoteLine
    ? [insight.line, "この入り方ずるい。", "一回開いてしまうタイプ。", "こういうの、気づいたら最後まで見てる。", "言葉より先に見せ方で持っていく。", "この人、他の投稿も少し気になる。"]
    : [insight.value, "ぱっと見で気になる場所がある。", "説明より先に、引用元で一回引っかかる。", "この出し方ならタイムラインでも目が戻る。"];
  const second = closers[(variant + stableHash(firstLine)) % closers.length];
  return [firstLine, second === firstLine ? closers[(variant + 1) % closers.length] : second];
}

function buildAuthorityCopy(product: MyfansProduct, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null, variant = 0) {
  const insight = topicValue?.verdict === "PASS" ? discoveryInsightFromTopic(topicValue) : null;
  const passedTopic = topicValue?.verdict === "PASS" ? topicValue : null;
  if (!insight || !passedTopic) return ["束ねて語れる差が弱いので今日は出さない。"];
  const secondEvidence = passedTopic.evidence[1] ?? (
    passedTopic.reasonToCare === "rapid_growth" || passedTopic.reasonToCare === "unexpected_popularity"
      ? "数字だけではなく、引用元の見せ方まで一緒に残っている"
      : ""
  );
  if (!secondEvidence) return ["束ねて語れる差が弱いので今日は出さない。"];
  const openers = [
    `今日残すなら、${insight.line}`,
    `${shortTitle(product.title)}は、${insight.line}`,
    `この組み合わせなら、${insight.line}`,
  ];
  const seconds = [
    `${secondEvidence}。ここまで揃うと、先に見る理由になる。`,
    `${secondEvidence}。数字と見た目の両方で違いが出ている。`,
    `${secondEvidence}。一つの条件だけで選ぶより分かりやすい。`,
  ];
  return [openers[variant % openers.length], seconds[variant % seconds.length]];
}

function buildRevenueCopy(product: MyfansProduct, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null, variant = 0) {
  const discovery = topicValue?.verdict === "PASS" ? discoveryInsightFromTopic(topicValue) : null;
  const first = discovery?.line ?? "話す価値の根拠が弱いので今日は出さない。";
  const second = variant % 2 === 0 ? "気になる人だけ自己リプへ。 #PR" : "詳細は自己リプに分けます。 #PR";
  return [first, second];
}

export function stopReasonFor(postType: string, product: MyfansProduct) {
  const angle = inferAngle(product);
  if (postType === "ranking_note") return "価格や順位などの数字を先頭に置き、比較目的の読者を止める。";
  if (postType === "profile_cta") return `自己紹介ではなく「${angle}」という判断軸から入る。`;
  if (postType === "reply_link_sales" || postType === "body_link_sales") return "売り込み前に、合う人だけ分かる具体条件を置く。";
  return `「${angle}」という好みの分かれ目を最初に見せる。`;
}

export function bodyFor(product: MyfansProduct, postType: string, linkStrategy: MyfansLinkStrategy, creativeStrategy: MyfansCreativeStrategy, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null, variant = 0) {
  const facts = publicCopyFactsFor(product, quote);
  const role = roleFor(postType, linkStrategy, creativeStrategy);
  const lines = role === "DISCOVERY"
    ? buildDiscoveryCopy(product, quote, topicValue, variant)
    : role === "AUTHORITY"
      ? buildAuthorityCopy(product, quote, topicValue, variant)
      : role === "REVENUE"
        ? buildRevenueCopy(product, quote, topicValue, variant)
        : facts.quoteVisualAnalysis?.status === "verified"
          ? buildPublicCopyV10(facts, postType, linkStrategy, variant)
          : buildPublicCopyV8(facts, postType, linkStrategy, variant);
  const link = linkStrategy === "body_link" && product.affiliate_url ? product.affiliate_url : "";
  return fitXBody([...lines, link].filter(Boolean), link ? 235 : 210);
}

export function fitXBody(lines: string[], maxWeight: number) {
  const candidates = [
    lines,
    lines.filter((_, index) => index !== 2),
    lines.slice(0, 2),
    lines.slice(0, 1),
  ];
  for (const candidate of candidates) {
    const text = candidate.join("\n\n").trim();
    if (text && getXWeightedLength(text) <= maxWeight) return text;
  }
  return lines[0].replace(/\s+/g, " ").slice(0, 80).trim();
}
