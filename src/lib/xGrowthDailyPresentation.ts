import type { XDailyTopPick, XGrowthIntent, XGrowthOpportunity, XOpportunitySourceType } from "./xGrowthOS";
import type { XCreativeVariant } from "./xCreativeEngine";
import { decisionFactProofLine } from "./domain/decisionFacts";
import { officialSampleVideoAllowed } from "./xGrowthEligibility";
import { recommendedTimeLabel } from "./xGrowthOpportunityScoring";
import { diversityConflicts } from "./xGrowthDailyDiversity";

function visualAndTrendReasons(item: XGrowthOpportunity) {
  return [
    officialSampleVideoAllowed(item) ? "動画で止まりやすい" : "",
    item.rankingHistory.status === "ready" && item.rankingHistory.rankingDelta && item.rankingHistory.rankingDelta >= 10 ? "昨日との差分で続報にできる" : "",
    item.imageUrl ? "画像で作品の雰囲気が一目で伝わる" : "",
  ].filter(Boolean);
}

function priceAndContextReasons(item: XGrowthOpportunity, role: XGrowthIntent) {
  return [
    item.isNinetyDayLow || item.discountRate >= 30 ? "今日見る理由が価格で説明できる" : "",
    item.ranking && item.ranking <= 30 ? "ランキング上位なので初見でも文脈が伝わる" : "",
    item.reviewAverage && item.reviewAverage >= 4.5 ? "評価を少し添えるだけで納得感が出る" : "",
    role === "FOLLOW" ? "毎日追うアカウントとして見せやすい" : "",
    item.freshness.reasons.find((reason) => reason.includes("セール終了")) ?? "",
  ].filter(Boolean);
}

function whyToday(item: XGrowthOpportunity, role: XGrowthIntent) {
  return [
    ...visualAndTrendReasons(item),
    ...priceAndContextReasons(item, role),
  ];
}

function selectedCreative(item: XGrowthOpportunity, role: XGrowthIntent) {
  return item.creativeVariants.find((creative) => creative.intent === role && creative.id === item.creativeVariantId)
    ?? item.creativeVariants.find((creative) => creative.intent === role)
    ?? item.creativeVariants[0];
}

function videoBuzzReason(item: XGrowthOpportunity) {
  if (officialSampleVideoAllowed(item)) {
    const tags = item.mediaAsset?.manual_tags ?? [];
    return tags.includes("first_seconds_strong")
      ? "権利OK動画の最初の数秒をHookにでき、本文は1〜3行の違和感だけに絞れる。"
      : "権利OK動画を証拠にでき、本文は1〜3行の気になる理由だけに絞れる。";
  }
  return "";
}

function cardBuzzReason(item: XGrowthOpportunity, variant: XCreativeVariant) {
  if (variant.mediaType !== "data_card") return "";
  const bySource: Partial<Record<XOpportunitySourceType, string>> = {
    MARKET: "カードで比較のきっかけを作り、本文は押し売りにしない。",
    COMPARISON: "一目で比較でき、迷っている人が最初の一本を決めやすい。",
    JUDGMENT: "カードと短い判断で、買うより先に見る理由が伝わる。",
  };
  return bySource[item.sourceType] ?? "";
}

function hookBuzzReason(variant: XCreativeVariant) {
  const byHook: Partial<Record<XCreativeVariant["hookDirection"], string>> = {
    contradiction: "一目で違和感が伝わり、数字を読ませる前に興味を作れる。",
    comparison: "ランキングだけでは拾えない候補として、比較で読まれやすい。",
    follow_up: "続報として出せるので、反応や会話が生まれやすい。",
    confession: "人間っぽい入り方で、知らない作品でも流されにくい。",
  };
  return byHook[variant.hookDirection] ?? variant.buzzPotential.reason;
}

function buzzReason(item: XGrowthOpportunity, role: XGrowthIntent) {
  const variant = selectedCreative(item, role);
  if (!variant) return "伸びる理由はまだ弱いため、採用は慎重に判断します。";
  const videoReason = variant.mediaType === "sample_movie" ? videoBuzzReason(item) : "";
  if (videoReason) return videoReason;
  if (variant.mediaType === "existing_link_image" && role !== "MONEY") return "画像で一度止めて、本文は説明ではなく見る理由だけを作れる。";
  return cardBuzzReason(item, variant) || hookBuzzReason(variant);
}

function sourceRoleLabel(sourceType: XOpportunitySourceType) {
  const labels: Record<XOpportunitySourceType, string> = {
    WORK: "作品を知るきっかけを作る",
    HIDDEN_GEM: "見落とし作品を拾う",
    ACTRESS_TREND: "女優の見方を変える",
    GENRE_TREND: "ジャンルの見方を変える",
    MAKER_TREND: "メーカー傾向を見る",
    MARKET: "市場全体の違和感を見る",
    COMPARISON: "比較判断を置く",
    JUDGMENT: "買う/見送る判断を置く",
    PRICE_EVENT: "今日見る理由を置く",
    FOLLOW_UP: "続報として追う",
    MONEY: "収益導線に送る",
  };
  return labels[sourceType];
}

function topPickMediaType(item: XGrowthOpportunity, variant: XCreativeVariant) {
  if (variant.mediaType === "data_card" && item.imageUrl && item.sourceType !== "PRICE_EVENT") return "existing_link_image" as const;
  if (variant.mediaType === "sample_movie" && !officialSampleVideoAllowed(item)) return item.imageUrl ? "existing_link_image" as const : "text" as const;
  return variant.mediaType;
}

function topPickMediaUrl(item: XGrowthOpportunity, mediaType: XCreativeVariant["mediaType"]) {
  if (mediaType === "sample_movie") return item.mediaAsset?.source_url ?? item.sampleMovieUrl;
  if (mediaType === "data_card") return `/api/admin/x-growth/media/download?workId=${item.workId}&mediaType=data_card`;
  return mediaType === "existing_link_image" ? item.imageUrl : null;
}

function topPickMediaUsage(mediaType: XDailyTopPick["mediaType"], mediaUrl: string | null | undefined): XDailyTopPick["mediaUsage"] {
  if (mediaType === "sample_movie") return "allowed";
  return mediaUrl || mediaType === "text" || mediaType === "quote" ? "allowed" : "not_available";
}

function topPickMediaDecision(item: XGrowthOpportunity, role: XGrowthIntent, mediaType: XDailyTopPick["mediaType"]) {
  if (mediaType === "sample_movie") return "公式FANZA/DMM sample_movie_urlを無加工投稿用のネイティブ動画として使用可";
  if (mediaType === "existing_link_image") return role === "MONEY" ? "MONEY投稿は現在Xで使っている作品リンク画像を維持" : "作品画像を優先。本文は画像説明ではなく見る理由に絞る";
  if (mediaType === "data_card") return item.sourceType === "PRICE_EVENT" ? "現在価格・発掘LABの記録最安・期限を載せた価格カード" : "比較自体が面白い場合だけデータカードを使用";
  if (mediaType === "quote") return "外部投稿確認後の引用候補。自動引用はしない";
  return "利用可能な画像/動画がないためテキストのみ";
}

function resolveTopPickMedia(item: XGrowthOpportunity, role: XGrowthIntent, variant: XCreativeVariant) {
  const mediaType = topPickMediaType(item, variant);
  const mediaUrl = topPickMediaUrl(item, mediaType);
  return {
    mediaType,
    mediaUrl,
    mediaUsage: topPickMediaUsage(mediaType, mediaUrl),
    mediaDecision: topPickMediaDecision(item, role, mediaType),
  };
}

export function buildTopPickCandidate(input: {
  item: XGrowthOpportunity;
  role: XGrowthIntent;
  variant: XCreativeVariant;
  audit: ReturnType<typeof diversityConflicts>;
  score: number;
  pickOrder: number;
  slotId: XDailyTopPick["slotId"];
  slotRole: NonNullable<XDailyTopPick["slotRole"]>;
  slotLabel: string;
  candidateRank: NonNullable<XDailyTopPick["candidateRank"]>;
  reason: string;
}): XDailyTopPick {
  const decisionProof = input.item.decisionFacts ? decisionFactProofLine(input.item.decisionFacts) : "";
  const decisionPostText = decisionProof && !input.variant.bodyText.includes(decisionProof)
    ? `${decisionProof}\n${input.variant.bodyText}`
    : input.variant.bodyText;
  const media = resolveTopPickMedia(input.item, input.role, input.variant);
  return applyTopPickLinkPolicy({
    ...input.item,
    intent: input.role,
    postText: decisionPostText,
    replyText: input.variant.replyText,
    creativeVariantId: input.variant.id,
    mediaType: media.mediaType,
    mediaUsage: media.mediaUsage,
    recommendedMediaUrl: media.mediaUrl,
    mediaDecision: media.mediaDecision,
    pickOrder: input.pickOrder,
    slotId: input.slotId,
    slotRole: input.slotRole,
    slotLabel: input.slotLabel,
    candidateRank: input.candidateRank,
    candidateId: `${input.slotId}-${input.candidateRank}-${input.item.key}-${input.variant.id}`.slice(0, 180),
    isSelected: input.candidateRank === "A",
    role: input.role,
    dailyScore: input.score,
    recommendedTimeLabel: recommendedTimeLabel(input.item.recommendedSlot),
    whyToday: whyToday(input.item, input.role),
    whyBuzz: buzzReason(input.item, input.role),
    notPostReason: null,
    alternativeReason: input.reason,
    setDiversity: {
      status: input.audit.ok ? "OK" : "NG",
      roleLabel: sourceRoleLabel(input.item.sourceType),
      signature: input.audit.signature,
      reasons: input.audit.reasons,
    },
  });
}

function stripUrls(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !/^https?:\/\//.test(line))
    .join("\n")
    .trim();
}

function appendUrlIfMissing(text: string, url: string) {
  const clean = text.trim();
  return clean.includes(url) ? clean : `${clean}\n${url}`;
}

function selfReplyText(url: string) {
  return `#PR\n必要な時だけ確認用です。\n${url}`;
}

function applyTopPickLinkPolicy(item: XDailyTopPick): XDailyTopPick {
  const selectedVariant = item.creativeVariants.find((variant) => variant.id === item.creativeVariantId) ?? item.creativeVariants[0];
  if (item.role !== "MONEY") {
    return {
      ...item,
      postText: stripUrls(item.postText),
      replyText: null,
      setDiversity: {
        ...item.setDiversity,
        signature: {
          ...item.setDiversity.signature,
          linkStrategy: "no_link",
        },
      },
    };
  }
  const url = selectedVariant?.url ?? item.creativeVariants[0]?.url ?? `/works/${item.workId}`;
  const linkPlan = selectedVariant?.linkPlan === "reply_link" ? "reply_link" : "body_link";
  if (linkPlan === "reply_link") {
    return {
      ...item,
      postText: stripUrls(item.postText),
      replyText: selfReplyText(url),
      setDiversity: {
        ...item.setDiversity,
        signature: {
          ...item.setDiversity.signature,
          linkStrategy: "reply_link",
        },
      },
    };
  }
  return {
    ...item,
    postText: appendUrlIfMissing(stripUrls(item.postText), url),
    replyText: null,
    setDiversity: {
      ...item.setDiversity,
      signature: {
        ...item.setDiversity.signature,
        linkStrategy: "body_link",
      },
    },
  };
}
