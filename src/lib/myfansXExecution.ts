import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate, MyfansXPost } from "@/lib/myfansAnalytics";
import { calculateMyfansOpportunityScores } from "@/lib/myfansScore";
import { getXWeightedLength } from "@/lib/xText";

export type MyfansLinkStrategy = "body_link" | "reply_link" | "profile_cta" | "no_link";
export type MyfansGrowthStage = "day_1_7" | "day_8_14" | "day_15_30";
export type MyfansObjective = "impression" | "profile_visit" | "follow" | "click" | "conversion";
export type MyfansCreativeStrategy = "quote_post" | "myfans_ogp" | "comparison_card" | "ranking_card" | "discovery_card" | "revenue_data_card" | "text_only" | "permitted_media";
export type MyfansQuoteCollectionTask = {
  id: string;
  creatorName: string;
  creatorXUrl: string;
  sourceXHandle: string;
  creatorId: number | null;
  productId: number | null;
  productTitle: string;
  instruction: string;
  collectedCount: number;
  topCandidates: Array<{ rank: number; xPostUrl: string; quoteUrl: string; mediaType: string; quoteVisualReady: boolean; urlKind: "media_permalink" | "status"; score: number; reason: string }>;
  topScore: number | null;
  globalRank: number | null;
  selectedForToday: boolean;
  lastCollectedAt: string | null;
  nextRefreshLabel: string;
  plannedSlot: string;
};

export const MYFANS_PROFILE_GUIDE = {
  handle: "@lumi_reviw",
  displayName: "るみ | myfans発掘と比較",
  bio: "myfansの新着、反応が強い投稿、価格の違いを毎日見て、探す前に役立つ発見だけ短く残します。18歳未満は見ないでください。PRを含む場合があります。",
  pinnedPost:
    "myfansを大量に探す前に、ここだけ見れば当たりを付けられる場所にします。\n\n毎日見るところ\n1. 新着なのに反応が出ている投稿\n2. 価格と内容のズレが大きいもの\n3. ひと目で好みが分かれる強い投稿\n4. PRはPRとして分けて明記\n\n成人向けです。18歳未満は見ないでください。",
  role:
    "フォロワー0期は販売アカウントに見せすぎず、発掘・比較アカウントとしてフォロー理由を作る。",
};

export const MYFANS_GROWTH_TARGETS = {
  followersMin: 50,
  followersMax: 100,
  postsOver1000Min: 3,
  postsOver1000Max: 5,
  postsOver5000: 1,
  clicks: 1,
  conversions: 1,
};

export const MYFANS_DIAGNOSIS_THRESHOLDS = {
  minimumSamplePosts: 7,
  exposureImpressions: 1000,
  profileVisitRate: 0.01,
  followRate: 0.08,
  clickRate: 0.003,
  conversionRate: 0.02,
};

const PERIOD_DAYS = { seven: 7, thirty: 30 } as const;

function cutoffIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function inPeriod(value: string | null | undefined, days: number) {
  return Boolean(value && value >= cutoffIso(days));
}

type RotationItem = { postType: string; linkStrategy: MyfansLinkStrategy; objective: MyfansObjective; cta: string; slot: string; role: string };
type DailyRole = "ATTENTION" | "DISCOVERY" | "AUTHORITY" | "REVENUE";
type HookType =
  | "GAP"
  | "HUMAN_STORY"
  | "STRONG_VISUAL"
  | "RAPID_GROWTH"
  | "DATA_ANOMALY"
  | "NEWCOMER"
  | "RANKING_SURGE"
  | "PRICE_ANOMALY"
  | "SOCIAL_PROOF"
  | "COMPARISON"
  | "SCARCITY_DEADLINE";

type AudienceIntent = "broad_curiosity" | "creator_interest" | "category_interest" | "comparison_shopper" | "purchase_intent" | "returning_follower";
export const MYFANS_PUBLIC_COPY_GENERATOR_VERSION = "public-copy-v13-daily-freshness";
export const MYFANS_VISUAL_ANALYZER_VERSION = "visual-understanding-v3-logged-in-chrome";
export const MYFANS_PUBLIC_COPY_V9_GENERATOR_VERSION = "public-copy-v9-visual-grounded";
export const MYFANS_PUBLIC_COPY_V10_GENERATOR_VERSION = "public-copy-v10-human-observation";
export const MYFANS_QUALITY_GATE_MINIMUM = 85;
export const MYFANS_ATTENTION_VALUE_MINIMUM = 85;
export const MYFANS_TOPIC_VALUE_THRESHOLDS: Record<DailyRole, number> = { ATTENTION: 85, DISCOVERY: 80, AUTHORITY: 75, REVENUE: 75 };
const MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS = 12;
const MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC = 6;
const MYFANS_DAILY_AVERAGE_QUALITY_MINIMUM = 90;

export type MyfansReasonToCare =
  | "unexpected_popularity"
  | "visual_gap"
  | "creator_outlier"
  | "ranking_anomaly"
  | "price_anomaly"
  | "rapid_growth"
  | "strong_human_story"
  | "clear_comparison"
  | "rare_visual_moment"
  | "conversation_worthy";

export type MyfansTopicValue = {
  score: number;
  verdict: "PASS" | "LOW_TOPIC_VALUE";
  reasonToCare: MyfansReasonToCare | null;
  evidence: string[];
  baseline: string[];
  whyRejected: string[];
  breakdown: {
    surprise: number;
    concreteDifference: number;
    humanCuriosity: number;
    socialProofMomentum: number;
    visualStoryValue: number;
    explainability: number;
  };
};

export type PublicCopyFacts = {
  sourceText: string;
  creatorName: string;
  creatorHandle: string;
  publicMetrics: {
    views: number | null;
    likes: number | null;
    reposts: number | null;
    replies: number | null;
    popularityRank: number | null;
    productLikes: number;
    productSaves: number;
    price: number;
    isNew: boolean;
  };
  visualContext: "video" | "image" | "public_post" | "text_only";
  quoteVisualAnalysis: QuoteVisualAnalysis | null;
  productFacts: {
    title: string;
    genre: string;
  };
};

type HumanReactionType = "surprise" | "agreement" | "curiosity" | "contrast" | "immediacy" | "specific_appeal" | "unexpected" | "visual_clarity";
type CopySearchAngle = "direct_reaction" | "surprise" | "contrast" | "curiosity" | "visual_specificity" | "social_proof_secondary" | "editorial_insight";

type VisualUnderstanding = {
  visualAnalysisStatus: "verified" | "partial" | "unavailable";
  analyzerVersion: string;
  mediaType: "video" | "image" | "public_post" | "text_only";
  frameOrImageCount: number;
  sceneOrSubjectSummary: string;
  subjectSummary: string;
  visibleChangeOrContrast: string;
  visualMoment: string;
  firstImpressionCue: string;
  contrastGap: string;
  visualCue: string;
  motionCue: string;
  compositionOrStyle: string;
  facialExpressionOrPoseCue: string;
  cameraDistanceOrFraming: string;
  textOverlayCue: string;
  sourceTextCue: string;
  sourceAngle: string;
  concreteVisualCue: string;
  cueConfidence: "high" | "medium" | "low";
  sourceEvidence: string;
  evidenceSource: string;
  rawVisualEvidence: string;
  humanObservation: string;
  attentionMoment: string;
  attentionValue: AttentionValue;
  uncertaintyLevel: "low" | "medium" | "high";
  visualExplainsAppeal: boolean;
  standoutMoment: string;
};

type QuoteVisualAnalysis = {
  status: "verified" | "partial" | "unavailable";
  mediaType: "video" | "image" | "public_post" | "text_only";
  frameOrImageCount: number;
  sceneSummary: string;
  subjectSummary: string;
  composition: string;
  facialExpressionOrPoseCue: string;
  cameraDistanceOrFraming: string;
  visibleChangeOrContrast: string;
  textOverlayCue: string;
  motionCue: string;
  beginningVsLaterChange: string;
  standoutMoment: string;
  concreteObservation: string;
  confidence: "high" | "medium" | "low";
  evidenceSource: string;
  analyzerVersion: string;
};

type AttentionValue = {
  score: number;
  curiosity: number;
  emotionalPull: number;
  visualSpecificity: number;
  broadComprehensibility: number;
  naturalReaction: number;
  reasons: string[];
  weakCue: boolean;
};

export const MYFANS_30_DAY_STRATEGY: Record<MyfansGrowthStage, {
  label: string;
  postsPerDay: string;
  normalPrRatio: string;
  linkMix: Record<MyfansLinkStrategy, number>;
  changeRule: string;
  focus: string;
}> = {
  day_1_7: {
    label: "Day1-7",
    postsPerDay: "4本固定",
    normalPrRatio: "通常3 : PR1",
    linkMix: { no_link: 2, profile_cta: 1, reply_link: 1, body_link: 0 },
    changeRule: "50表示未満が同じ型で3回続いたら、その型を翌日から止める。",
    focus: "まず表示とプロフィール遷移を作る。直リンク販売は1日1本だけ。",
  },
  day_8_14: {
    label: "Day8-14",
    postsPerDay: "3-5本可変",
    normalPrRatio: "通常2-3 : PR1-2",
    linkMix: { no_link: 1, profile_cta: 1, reply_link: 1, body_link: 1 },
    changeRule: "24時間300表示以上の型を翌日に1本増やし、50表示未満の型を減らす。",
    focus: "プロフィール誘導、自己リプ、本文リンクの差を見る。",
  },
  day_15_30: {
    label: "Day15-30",
    postsPerDay: "3-6本可変",
    normalPrRatio: "Growth50% / Revenue30% / LTV20%",
    linkMix: { no_link: 1, profile_cta: 1, reply_link: 2, body_link: 1 },
    changeRule: "7日/30日Learningで勝ち型だけ再利用。CVが出た型は同ジャンルで横展開する。",
    focus: "伸びた通常投稿にだけ収益導線を足し、フォローと売上を同時に取る。",
  },
};

const ROTATION: Record<MyfansGrowthStage, RotationItem[]> = {
  day_1_7: [
    { postType: "discovery_interest", linkStrategy: "no_link", objective: "impression", cta: "保存用の発見メモ", slot: "12:10", role: "露出を作る" },
    { postType: "ranking_note", linkStrategy: "no_link", objective: "impression", cta: "日間ランキングの観測メモ", slot: "17:40", role: "比較で見られる理由を作る" },
    { postType: "profile_cta", linkStrategy: "profile_cta", objective: "profile_visit", cta: "過去の発掘メモはプロフィールにまとめています", slot: "20:10", role: "プロフィールへ送る" },
    { postType: "reply_link_sales", linkStrategy: "reply_link", objective: "click", cta: "気になる人だけ自己リプへ", slot: "23:00", role: "リンク型を小さく試す" },
  ],
  day_8_14: [
    { postType: "comparison_review", linkStrategy: "profile_cta", objective: "follow", cta: "迷う人向けにプロフィールへ", slot: "12:20", role: "比較でフォロー理由を作る" },
    { postType: "discovery_interest", linkStrategy: "no_link", objective: "impression", cta: "保存用の発見メモ", slot: "17:50", role: "露出の土台を残す" },
    { postType: "reply_link_sales", linkStrategy: "reply_link", objective: "click", cta: "詳細は自己リプ", slot: "20:40", role: "自己リプリンクを試す" },
    { postType: "body_link_sales", linkStrategy: "body_link", objective: "click", cta: "詳細を見る", slot: "23:10", role: "本文リンクを少量試す" },
  ],
  day_15_30: [
    { postType: "winner_reuse", linkStrategy: "reply_link", objective: "conversion", cta: "前に反応がよかった型で再掲", slot: "12:10", role: "勝ち型を再利用する" },
    { postType: "comparison_review", linkStrategy: "body_link", objective: "click", cta: "詳細を見る", slot: "20:30", role: "クリック効率を取りにいく" },
    { postType: "profile_cta", linkStrategy: "profile_cta", objective: "follow", cta: "今後の発掘メモはプロフィールから", slot: "23:00", role: "フォロー導線を残す" },
  ],
};

export function getGrowthStage(day: number): MyfansGrowthStage {
  if (day <= 7) return "day_1_7";
  if (day <= 14) return "day_8_14";
  return "day_15_30";
}

export function getOperationDay(startDate = process.env.MYFANS_X_OPERATION_START_DATE) {
  if (!startDate) return 1;
  const start = new Date(`${startDate}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(start)) return 1;
  const now = Date.now();
  return Math.min(30, Math.max(1, Math.floor((now - start) / 86_400_000) + 1));
}

function shortTitle(title: string) {
  const compact = title
    .replace(/\[[^\]]{10,}\]/g, "")
    .replace(/【[^】]{18,}】/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > 22 ? `${compact.slice(0, 22)}...` : compact || "myfans作品";
}

function productSignalList(product: MyfansProduct) {
  const rows = [
    product.is_new ? "新着" : "",
    product.price > 0 ? `¥${product.price.toLocaleString("ja-JP")}` : "",
    product.popularity_rank ? `人気${product.popularity_rank}位` : "",
    product.likes_count > 0 ? `いいね${product.likes_count.toLocaleString("ja-JP")}` : "",
    product.saves_count > 0 ? `保存${product.saves_count.toLocaleString("ja-JP")}` : "",
  ].filter(Boolean);
  return rows.length ? rows : ["条件確認中"];
}

function inferAngle(product: MyfansProduct) {
  const source = `${product.title} ${product.genre} ${product.selection_reason}`.toLowerCase();
  if (/巨乳|cup|カップ|爆乳|胸|乳/.test(source)) return "体型の分かりやすさ";
  if (/人妻|熟女|夫婦|妻|ママ/.test(source)) return "背徳感と生活感";
  if (/顔出し|完全顔|透明感|港区|女子大|jd|ol/.test(source)) return "人物像の強さ";
  if (/主観|ハメ撮り|個人|素人|vlog/.test(source)) return "距離感の近さ";
  if (/割引|sale|セール|削除|限定|明日まで/.test(source)) return "今見る理由";
  return "タイトルで刺さる人がはっきりしているところ";
}

function inferAudience(product: MyfansProduct) {
  const source = `${product.title} ${product.genre} ${product.selection_reason}`.toLowerCase();
  if (/巨乳|cup|カップ|爆乳|胸|乳/.test(source)) return "分かりやすい体型訴求で選びたい人";
  if (/人妻|熟女|夫婦|妻|ママ/.test(source)) return "背徳感や生活感のある作品が好きな人";
  if (/顔出し|完全顔|透明感|港区|女子大|jd|ol/.test(source)) return "人物の雰囲気まで見て選びたい人";
  if (/主観|ハメ撮り|個人|素人|vlog/.test(source)) return "作り込みより距離感を重視する人";
  return "タイトルと条件を見て直感で選びたい人";
}

function angleAppeal(product: MyfansProduct) {
  const angle = inferAngle(product);
  if (angle === "体型の分かりやすさ") return "好みが一瞬で判断できる";
  if (angle === "背徳感と生活感") return "設定より空気感で残る";
  if (angle === "人物像の強さ") return "誰が出ているかで選びやすい";
  if (angle === "距離感の近さ") return "作り込みより近さで刺さる";
  if (angle === "今見る理由") return "後回しにしにくい条件がある";
  return "刺さる人とスルーする人が分かれやすい";
}

function visualRenderStatus(candidate: MyfansQuoteCandidate | null | undefined) {
  if (!candidate) return "unknown" as const;
  if (candidate.visual_render_status) return candidate.visual_render_status;
  const status = candidate.media_permalink_validation_status ?? "";
  if (candidate.media_type === "video" && /verified_video_permalink/.test(status)) return "browser_visible" as const;
  if (candidate.media_type === "image" && candidate.quote_visual_ready && candidate.media_permalink) return "browser_visible" as const;
  if (/not_rendered/i.test(status)) return "app_only" as const;
  if (/blocked|sensitive|timeout|no_result/i.test(status)) return "blocked" as const;
  return "unknown" as const;
}

function hasBrowserVisibleVisual(candidate: MyfansQuoteCandidate | null | undefined) {
  return Boolean(candidate?.quote_visual_ready && candidate.media_permalink && visualRenderStatus(candidate) === "browser_visible" && (candidate.media_type === "image" || candidate.media_type === "video"));
}

function hasVerifiedVisualAnalysis(candidate: MyfansQuoteCandidate | null | undefined) {
  return visualAnalysisForQuote(candidate ?? null)?.status === "verified";
}

function quoteInsight(quote: MyfansQuoteCandidate | null) {
  if (!quote) return "";
  const metrics = [
    quote.views ? `表示${quote.views.toLocaleString("ja-JP")}` : "",
    quote.likes ? `いいね${quote.likes.toLocaleString("ja-JP")}` : "",
    quote.reposts ? `RP${quote.reposts.toLocaleString("ja-JP")}` : "",
  ].filter(Boolean);
  return metrics.length ? metrics.slice(0, 2).join(" / ") : "元投稿の反応を確認済み";
}

function compactSourceText(text: string, max = 34) {
  return text.replace(/\s+/g, " ").replace(/https?:\/\/\S+/g, "").trim().slice(0, max);
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeVisualEvidence(text: string) {
  return text.replace(/\s+/g, " ").replace(/[「」『』]/g, "").trim();
}

function humanObservationFromEvidence(analysis: QuoteVisualAnalysis | null, mediaType: PublicCopyFacts["visualContext"], variant = 0) {
  const raw = normalizeVisualEvidence([
    analysis?.concreteObservation,
    analysis?.standoutMoment,
    analysis?.sceneSummary,
    analysis?.composition,
    analysis?.cameraDistanceOrFraming,
    analysis?.visibleChangeOrContrast,
    analysis?.motionCue,
  ].filter(Boolean).join(" / "));
  if (!analysis || analysis.status !== "verified" || raw.length < 5) return "";
  const options: string[] = [];
  if (/白|室内|部屋/.test(raw) && /踊|動き|動画|冒頭/.test(raw)) {
    options.push("白っぽい部屋で動き出すところが先に目に入る");
    options.push("部屋の明るさと動き出しで、最初の数秒が軽く見える");
  }
  if (/くま|熊|クマ|bear/i.test(raw)) {
    options.push("くまっぽい小物が入っていて、画面が少しゆるく見える");
  }
  if (/ベッド|向かい合|手前|距離/.test(raw)) {
    options.push("白いベッド越しの距離感が近くて、場面がすぐ分かる");
    options.push("手前に人が入るだけで、向かい合っている近さが出る");
  }
  if (/砂浜|海|夏/.test(raw) && /赤|黒/.test(raw)) {
    options.push("砂浜の明るさに赤と黒がぱっと浮いて見える");
    options.push("海辺の明るい画面で、赤と黒の色だけ先に残る");
  }
  if (/引き|近|寄り|画角|フレーミング|切り替わ|距離感が近く/.test(raw)) {
    options.push("引きで見せてから少し近くなるので、そこで目が戻る");
    options.push("最初は引きなのに、途中で距離が詰まるのが分かる");
  }
  if (/全身/.test(raw)) {
    options.push("全身が見える切り取りで、好みかどうかが早い");
  }
  if (/制服|階段|プロフィール|白いプロフィール/.test(raw)) {
    options.push("階段の写真から白いプロフィール画面に切り替わるのが目に残る");
    options.push("制服っぽい写真のあとにプロフィール画面が出て、流れが分かりやすい");
  }
  if (!options.length && /冒頭|最初|動画|motion|動き/i.test(raw)) {
    options.push("冒頭の動きだけで、流すか見るかが決まる");
  }
  if (!options.length && mediaType === "image") {
    options.push("色と距離感が先に入ってくる一枚");
  }
  if (!options.length && mediaType === "video") {
    options.push("最初の数秒で見せ方が分かる動画");
  }
  return options[variant % options.length] ?? "";
}

function weakAttentionCue(text: string) {
  return /白いプロフィール|プロフィール画面|白っぽい部屋で動き出す|白い画面|単なる背景|背景色|室内の縦動画|縦動画だけ|室内で動く|部屋で動き出す|目に入るだけ|目に残るだけ|手が止まるだけ/.test(text);
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
  if (/制服/.test(raw) && /階段/.test(raw)) options.push("制服っぽい写真から入る");
  if (/赤|黒/.test(raw) && /砂浜|海|夏/.test(raw)) options.push("海辺で赤と黒だけぱっと浮く");
  if (/青/.test(raw) && /ランジェリー/.test(raw)) options.push("白いベッドに青いランジェリーが出る");
  if (/ベッド/.test(raw) && /距離|向かい合|手前|近/.test(raw)) options.push("ベッド越しの距離が近い");
  if (/くま|熊|クマ|bear/i.test(raw) && /踊|動き|冒頭/.test(raw)) options.push("くまっぽい小物と踊り出しのゆるさ");
  if (/引き/.test(raw) && /近|距離が近|寄り|上半身/.test(raw)) options.push("引きから近めに変わる");
  if (/全身/.test(raw)) options.push("全身で好みがすぐ分かる");
  if (/表情|顔|目線/.test(raw)) options.push("表情や目線で雰囲気が先に出る");
  if (/衣装|服装|ランジェリー|水着|ボトムス/.test(raw)) options.push("服装の色と見せ方がはっきりしている");
  if (/動き|踊|motion|冒頭|途中|切り替わ/.test(raw)) options.push(mediaType === "video" ? "途中で見え方が変わる" : "最初の切り取りで雰囲気が決まる");
  const strong = options.filter((item) => !weakAttentionCue(item));
  return (strong[variant % Math.max(1, strong.length)] ?? "").trim();
}

function attentionValueForText(text: string, moment = ""): AttentionValue {
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

function visualAnalysisForQuote(quote: MyfansQuoteCandidate | null): QuoteVisualAnalysis | null {
  if (!quote) return null;
  const raw = quote.visual_analysis_json && typeof quote.visual_analysis_json === "object" ? quote.visual_analysis_json : {};
  const status = quote.visual_analysis_status === "verified" || quote.visual_analysis_status === "partial" ? quote.visual_analysis_status : "unavailable";
  const concreteObservation = stringField(raw.concrete_observation) || stringField(raw.concreteObservation) || stringField(raw.attention_worthy_moment) || stringField(raw.standout_moment) || stringField(raw.standoutMoment);
  const evidenceSource = stringField(raw.evidence_source) || stringField(raw.evidenceSource) || stringField(quote.media_permalink) || stringField(quote.x_post_url);
  const confidenceRaw = stringField(raw.confidence);
  const confidence = confidenceRaw === "high" || confidenceRaw === "medium" ? confidenceRaw : status === "verified" ? "medium" : "low";
  const mediaType = quote.media_type === "video" ? "video" : quote.media_type === "image" ? "image" : quote ? "public_post" : "text_only";
  const verifiedEnough = status === "verified" && concreteObservation.length >= 5 && evidenceSource.length > 0 && hasBrowserVisibleVisual(quote);
  return {
    status: verifiedEnough ? "verified" : status === "partial" ? "partial" : "unavailable",
    mediaType,
    frameOrImageCount: typeof raw.frame_or_image_count === "number" ? raw.frame_or_image_count : quote.media_count ?? (mediaType === "text_only" ? 0 : 1),
    sceneSummary: stringField(raw.scene_summary) || stringField(raw.sceneSummary),
    subjectSummary: stringField(raw.subject_summary) || stringField(raw.subjectSummary),
    composition: stringField(raw.composition),
    facialExpressionOrPoseCue: stringField(raw.facial_expression_or_pose_cue) || stringField(raw.facialExpressionOrPoseCue),
    cameraDistanceOrFraming: stringField(raw.camera_distance_or_framing) || stringField(raw.camera_distance) || stringField(raw.framing),
    visibleChangeOrContrast: stringField(raw.visible_change_or_contrast) || stringField(raw.visible_change) || stringField(raw.beginning_vs_later) || stringField(raw.beginning_vs_later_change),
    textOverlayCue: stringField(raw.text_overlay_cue) || stringField(raw.caption_cue),
    motionCue: stringField(raw.motion_cue) || stringField(raw.motion_change_cue),
    beginningVsLaterChange: stringField(raw.beginning_vs_later_change) || stringField(raw.beginningVsLaterChange) || stringField(raw.beginning_vs_later),
    standoutMoment: stringField(raw.standout_moment) || stringField(raw.standoutMoment) || stringField(raw.attention_worthy_moment),
    concreteObservation,
    confidence,
    evidenceSource,
    analyzerVersion: quote.visual_analyzer_version || MYFANS_VISUAL_ANALYZER_VERSION,
  };
}

function visualUnderstandingFor(facts: PublicCopyFacts): VisualUnderstanding {
  const source = compactSourceText(facts.sourceText, 48);
  const productText = `${facts.productFacts.title} ${facts.productFacts.genre}`;
  const productSource = productText.toLowerCase();
  const mediaType = facts.visualContext;
  const concreteCueFromSource = (() => {
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
  })();
  const concreteCueFromProduct = (() => {
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
  })();
  const verified = facts.quoteVisualAnalysis?.status === "verified" ? facts.quoteVisualAnalysis : null;
  const concreteVisualCue = verified?.concreteObservation || concreteCueFromSource || concreteCueFromProduct;
  const attentionMoment = attentionWorthyMomentFromEvidence(verified, mediaType);
  const rawVisualEvidence = verified
    ? normalizeVisualEvidence([verified.concreteObservation, verified.standoutMoment, verified.sceneSummary, verified.composition, verified.cameraDistanceOrFraming, verified.visibleChangeOrContrast, verified.motionCue].filter(Boolean).join(" / "))
    : "";
  const humanObservation = humanObservationFromEvidence(verified, mediaType);
  const cueConfidence = verified?.confidence ?? (concreteCueFromSource ? "high" : concreteCueFromProduct ? "medium" : "low");
  const visualMoment = mediaType === "video"
    ? (concreteVisualCue || "冒頭の数秒で雰囲気が伝わる")
    : mediaType === "image"
      ? (concreteVisualCue || "最初の1枚で雰囲気が伝わる")
      : source
        ? "元投稿本文の入りで場面を想像できる"
        : "視覚情報は未確認";
  const firstImpressionCue = mediaType === "video"
    ? "動き出しで続きを見たくなる"
    : mediaType === "image"
      ? "流れてきた瞬間に止まる"
      : source
        ? "言い出しで気になる"
        : "数字以外の手がかりが薄い";
  const contrastGap = /最初|途中|あと|ギャップ|急|変わ/.test(facts.sourceText)
    ? "最初と後半で印象が変わる"
    : /素人|個人|主観|vlog|日常|彼女|顔/.test(productSource)
      ? "作り込みすぎない近さが強みになりやすい"
      : "ひと目で好みが分かれる";
  const visualCue = /顔|透明感|港区|女子大|jd|ol/.test(productSource)
    ? "人物の雰囲気が入口になる"
    : /巨乳|cup|カップ|爆乳|胸|乳/.test(productSource)
      ? "分かりやすい見た目の強さが入口になる"
      : /人妻|熟女|夫婦|妻|ママ/.test(productSource)
        ? "生活感や距離感が入口になる"
    : concreteVisualCue || "見た瞬間の分かりやすさが入口になる";
  return {
    visualAnalysisStatus: verified ? "verified" : facts.quoteVisualAnalysis?.status === "partial" ? "partial" : "unavailable",
    analyzerVersion: facts.quoteVisualAnalysis?.analyzerVersion ?? MYFANS_VISUAL_ANALYZER_VERSION,
    mediaType,
    frameOrImageCount: facts.quoteVisualAnalysis?.frameOrImageCount ?? (mediaType === "text_only" ? 0 : 1),
    sceneOrSubjectSummary: verified?.sceneSummary || verified?.subjectSummary || concreteCueFromProduct || concreteCueFromSource || (source ? `元投稿本文: ${source}` : "具体的なscene情報なし"),
    subjectSummary: verified?.subjectSummary || "",
    visibleChangeOrContrast: verified?.visibleChangeOrContrast || verified?.beginningVsLaterChange || (concreteCueFromSource && /変わ|違う|ギャップ|途中/.test(concreteCueFromSource) ? concreteCueFromSource : contrastGap),
    visualMoment: verified?.standoutMoment || visualMoment,
    firstImpressionCue,
    contrastGap,
    visualCue,
    motionCue: verified?.motionCue || (mediaType === "video" ? (concreteCueFromSource || "冒頭の動きで印象が決まる") : ""),
    compositionOrStyle: verified?.composition || (/アップ|近|主観|自撮り/.test(productSource + source) ? "距離感が近い見せ方" : /引き|一枚|1枚|画像|写真/.test(productSource + source) ? "1枚で判断させる切り取り" : ""),
    facialExpressionOrPoseCue: verified?.facialExpressionOrPoseCue || "",
    cameraDistanceOrFraming: verified?.cameraDistanceOrFraming || "",
    textOverlayCue: verified?.textOverlayCue || (/テロップ|字幕|文字|caption/i.test(facts.sourceText) ? source : ""),
    sourceTextCue: concreteCueFromSource,
    sourceAngle: source,
    concreteVisualCue,
    cueConfidence,
    sourceEvidence: verified?.evidenceSource || (concreteCueFromSource ? `source_text:${concreteCueFromSource}` : concreteCueFromProduct ? `product_title_or_genre:${concreteCueFromProduct}` : ""),
    evidenceSource: verified?.evidenceSource || "",
    rawVisualEvidence,
    humanObservation,
    attentionMoment,
    attentionValue: attentionValueForText(attentionMoment),
    uncertaintyLevel: verified ? "low" : concreteVisualCue ? (concreteCueFromSource ? "low" : "medium") : "high",
    visualExplainsAppeal: mediaType === "image" || mediaType === "video" || Boolean(source),
    standoutMoment: verified?.standoutMoment || "",
  };
}

function reactionTypeFor(facts: PublicCopyFacts, variant = 0): HumanReactionType {
  const types: HumanReactionType[] = facts.visualContext === "video"
    ? ["immediacy", "curiosity", "contrast", "agreement", "surprise", "specific_appeal", "unexpected", "visual_clarity"]
    : facts.visualContext === "image"
      ? ["visual_clarity", "agreement", "specific_appeal", "curiosity", "surprise", "unexpected", "immediacy", "contrast"]
      : ["curiosity", "agreement", "unexpected", "surprise", "specific_appeal", "immediacy", "visual_clarity", "contrast"];
  return types[variant % types.length];
}

function copySearchAngleFor(reasonToCare: MyfansReasonToCare | null | undefined, variant = 0): CopySearchAngle {
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

function roleFitsReasonToCare(role: DailyRole, reasonToCare: MyfansReasonToCare | null | undefined) {
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

function angleVariantSeed(slotIndex: number, attempt: number) {
  const topicRound = Math.floor(attempt / MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC);
  const angleIndex = attempt % MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC;
  return slotIndex * 17 + topicRound * 11 + angleIndex;
}

function currentPlanDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function recentUsedProductIds(analytics: MyfansAnalytics, days: number) {
  const cutoff = cutoffIso(days);
  return new Set(analytics.posts.filter((post) => (post.posted_at ?? post.created_at) >= cutoff && post.product_id).map((post) => post.product_id as number));
}

function audienceIntentFor(postType: string, product: MyfansProduct): AudienceIntent {
  if (postType === "reply_link_sales" || postType === "body_link_sales") return "purchase_intent";
  if (postType === "profile_cta" || postType === "winner_reuse") return "returning_follower";
  if (postType === "ranking_note" || postType === "comparison_review") return "comparison_shopper";
  if (product.myfans_creators?.display_name || product.creator_x_url) return "creator_interest";
  return product.genre ? "category_interest" : "broad_curiosity";
}

function hookIntelligence(product: MyfansProduct, quote: MyfansQuoteCandidate | null): { hook: HookType; evidence: Record<string, unknown>; label: string } {
  const text = `${product.title} ${product.genre} ${product.selection_reason}`.toLowerCase();
  if (hasBrowserVisibleVisual(quote)) {
    const visibleQuote = quote as MyfansQuoteCandidate;
    return { hook: "STRONG_VISUAL", label: "ブラウザ表示済みvisual", evidence: { x_post_url: visibleQuote.x_post_url, media_type: visibleQuote.media_type, media_permalink: visibleQuote.media_permalink, visual_render_status: visualRenderStatus(visibleQuote), verified: true } };
  }
  if ((quote?.views ?? 0) >= 50_000 || (quote?.likes ?? 0) >= 1000 || (quote?.reposts ?? 0) >= 100) {
    return { hook: "SOCIAL_PROOF", label: "反応の強いcreator投稿", evidence: { views: quote?.views, likes: quote?.likes, reposts: quote?.reposts, x_post_url: quote?.x_post_url } };
  }
  if (product.is_new && (product.likes_count >= 50 || product.saves_count >= 20 || (product.popularity_rank ?? 999) <= 10)) {
    return { hook: "NEWCOMER", label: "新着なのに反応あり", evidence: { is_new: product.is_new, likes_count: product.likes_count, saves_count: product.saves_count, popularity_rank: product.popularity_rank } };
  }
  if (product.popularity_rank && product.popularity_rank <= 10) {
    return { hook: "RANKING_SURGE", label: "ランキング上位", evidence: { popularity_rank: product.popularity_rank } };
  }
  if (product.saves_count >= Math.max(20, product.likes_count * 0.35)) {
    return { hook: "DATA_ANOMALY", label: "保存が目立つ", evidence: { saves_count: product.saves_count, likes_count: product.likes_count } };
  }
  if (/割引|sale|セール|削除|限定|明日まで|今日まで/.test(text)) {
    return { hook: "SCARCITY_DEADLINE", label: "期限・限定の根拠あり", evidence: { source: "title/genre/selection_reason" } };
  }
  if (product.price > 0 && product.price <= 1500 && product.estimated_reward > 0) {
    return { hook: "PRICE_ANOMALY", label: "低価格かつ報酬条件あり", evidence: { price: product.price, estimated_reward: product.estimated_reward } };
  }
  return { hook: "COMPARISON", label: "比較材料あり", evidence: { price: product.price, popularity_rank: product.popularity_rank, likes_count: product.likes_count, saves_count: product.saves_count } };
}

function dataStoryScore(product: MyfansProduct) {
  let score = 0;
  const reasons: string[] = [];
  if (product.popularity_rank && product.popularity_rank <= 10) { score += 30; reasons.push(`人気${product.popularity_rank}位`); }
  if (product.is_new) { score += 14; reasons.push("新着"); }
  if (product.saves_count >= 20) { score += Math.min(22, Math.round(product.saves_count / 4)); reasons.push(`保存${product.saves_count}`); }
  if (product.likes_count >= 100) { score += Math.min(18, Math.round(product.likes_count / 20)); reasons.push(`いいね${product.likes_count}`); }
  if (product.price > 0 && product.price <= 1500) { score += 16; reasons.push(`低価格¥${product.price.toLocaleString("ja-JP")}`); }
  if (product.reward_rate >= 80 || product.plan_signup_reward > 0) { score += 10; reasons.push("収益条件あり"); }
  return { score: Math.min(100, score), reasons };
}

function attentionScoreFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, analytics: MyfansAnalytics) {
  const quoteFreshness = quote ? Math.max(0, 18 - Math.round(daysSinceIso(quote.collected_at) ?? 18)) : 0;
  const verifiedVisual = hasBrowserVisibleVisual(quote);
  const verifiedVisualAnalysis = hasVerifiedVisualAnalysis(quote);
  const dataStory = dataStoryScore(product);
  const creatorPenalty = recentUsedCreatorKeys(analytics).has(creatorKeyFromProduct(product)) ? 14 : 0;
  const productPenalty = recentUsedProductIds(analytics, 3).has(product.id) ? 24 : 0;
  const quotePenalty = quote?.last_used_at || (quote && usedQuoteUrls(analytics).has(quoteUrlFromCandidate(quote))) ? 30 : 0;
  const engagement = Math.min(24, Math.round(((quote?.likes ?? product.likes_count) + (quote?.reposts ?? 0) * 3 + (quote?.replies ?? 0) * 2) / 30));
  const visual = verifiedVisualAnalysis ? 34 : verifiedVisual ? 24 : quote?.has_image || quote?.has_video ? 6 : 0;
  const score = Math.max(0, Math.min(100, visual + quoteFreshness + engagement + Math.round(dataStory.score * 0.35) - creatorPenalty - productPenalty - quotePenalty));
  return {
    score,
    visualStrength: visual,
    visualVerified: Boolean(verifiedVisual),
    visualAnalysisVerified: Boolean(verifiedVisualAnalysis),
    freshness: quoteFreshness,
    engagementStrength: engagement,
    dataStoryScore: dataStory.score,
    penalties: { creatorCooldown: creatorPenalty, productCooldown: productPenalty, quoteUsed: quotePenalty },
    reasons: [
      verifiedVisualAnalysis ? `visual-understanding-v2 verified ${quote?.media_type}` : verifiedVisual ? `browser visible ${quote?.media_type}` : "verified visualなし",
      ...dataStory.reasons.slice(0, 3),
      creatorPenalty ? "creator cooldown" : "",
      productPenalty ? "product cooldown" : "",
      quotePenalty ? "quote reuse禁止" : "",
    ].filter(Boolean),
  };
}

function qualityScoreFor(input: {
  body: string;
  product: MyfansProduct;
  postType: string;
  linkStrategy: MyfansLinkStrategy;
  creativeStrategy: MyfansCreativeStrategy;
  quote: MyfansQuoteCandidate | null;
  hook: HookType;
  attentionScore: number;
  topicValue?: MyfansTopicValue | null;
}) {
  const firstLine = input.body.split(/\n+/)[0] ?? "";
  const facts = publicCopyFactsFor(input.product, input.quote);
  const understanding = visualUnderstandingFor(facts);
  const attentionValue = attentionValueForText(input.body, understanding.attentionMoment || understanding.humanObservation);
  const leak = detectPublicCopyLeak(input.body);
  const hardFail = publicCopyHardFail(input.body);
  const isQuote = input.creativeStrategy === "quote_post";
  const role = roleFor(input.postType, input.linkStrategy, input.creativeStrategy);
  const isDiscovery = role === "DISCOVERY";
  const isAuthority = role === "AUTHORITY";
  const isRevenue = role === "REVENUE";
  const reactionWords = /え、|そりゃ|分かる|気になる|見たくなる|持って|止まる|ずるい|刺さる|残る|開いて|伝わる|強い|納得/;
  const visualWords = /動画|画像|1枚|一枚|数秒|冒頭|最初|途中|見た瞬間|雰囲気|空気|切り取り|近さ|見せ方|ぱっと見|これだけ|この1枚|見たら|見たく|開いて|顔|表情|衣装|制服|距離|アップ|引き|体型|タイトル|設定|生活感|自撮り|主観|テロップ|字幕/;
  const reportWords = /表示|いいね|RP|保存|人気|価格|¥|数字|反応の強さ|同価格帯|条件|比較|判断材料|分析/;
  const vagueReactionOnly = isQuote && /^(これ|この投稿|この1枚)?(流れてきたら一回止まる|強い|刺さる|見返したくなる|そりゃ伸びる|見せ方が分かりやすい|入口がある|入口がはっきり|好みが分かれる)[。！？!?]?/m.test(input.body.replace(/\s+/g, ""));
  const groundingText = understanding.attentionMoment || understanding.humanObservation || understanding.concreteVisualCue;
  const cueTokens = groundingText
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  const visualKeywordTokens = Array.from(new Set((groundingText.match(/制服|階段|赤|黒|砂浜|海辺|ベッド|距離|近|くま|踊|引き|近め|全身|表情|目線|衣装|服装|色|ポーズ|切り替わ|途中|変わる/g) ?? [])));
  const allCueTokens = [...cueTokens, ...visualKeywordTokens];
  const bodyCompact = input.body.replace(/[^\p{L}\p{N}]+/gu, "");
  const cueInBody = Boolean(groundingText && allCueTokens.some((token) => bodyCompact.includes(token.replace(/\s+/g, ""))));
  const firstTwoLines = input.body.split(/\n+/).slice(0, 2).join(" ");
  const cueEarly = cueInBody && allCueTokens.some((token) => firstTwoLines.replace(/[^\p{L}\p{N}]+/gu, "").includes(token.replace(/\s+/g, "")));
  const concreteVisualSpecificity = isQuote
    ? (cueEarly ? 30 : cueInBody ? 22 : visualWords.test(firstTwoLines) && understanding.concreteVisualCue ? 18 : 6)
    : 0;
  const observationFirstLine = isQuote && understanding.humanObservation && firstLine.includes(understanding.humanObservation);
  const readerCuriosity = firstLine.length >= 10 && firstLine.length <= 46 && /[。？?]$/.test(firstLine) && !/です。$|ます。$/.test(firstLine) && (reactionWords.test(firstLine) || observationFirstLine) ? 30 : firstLine.length >= 10 ? 18 : 8;
  const visualFit = visualWords.test(input.body) || (isQuote && hasBrowserVisibleVisual(input.quote) && reactionWords.test(input.body)) ? 25 : isQuote ? 6 : 14;
  const naturalness = machineLikeCopyIssue(input.body) ? 4 : reactionWords.test(input.body) ? 20 : 10;
  const curiosity = /気になる|見たくなる|開いて|戻りたく|先を|続き/.test(input.body) ? 15 : reactionWords.test(input.body) ? 11 : 5;
  const originality = /(そりゃ|ずるい|普通に|一回|残る|持っていかれる|盛らなくても|知らなくても)/.test(input.body) ? 10 : 6;
  const emotionalStopPower = Math.min(20, Math.round(readerCuriosity * 0.67));
  const visualTextFitV8 = isQuote ? (hasBrowserVisibleVisual(input.quote) && cueInBody ? 20 : cueInBody ? 14 : 4) : 0;
  const naturalnessV8 = Math.min(15, Math.round(naturalness * 0.75));
  const curiosityV8 = Math.min(10, Math.round(curiosity * 0.67));
  const originalityV8 = Math.min(5, Math.round(originality * 0.5));
  const concreteFact = visualFit;
  const visualTextFit = input.creativeStrategy === "quote_post"
    ? (hasBrowserVisibleVisual(input.quote) ? 25 : 0)
    : ["ranking_card", "comparison_card", "discovery_card"].includes(input.creativeStrategy)
      ? 12
      : 10;
  const readerRelevance = reactionWords.test(input.body) ? 15 : 8;
  const originalAngle = originality;
  const naturalLanguage = naturalness;
  const salesAdminSmell = hardFail.length ? 0 : 5;
  const roleDifferentiation = input.linkStrategy === "reply_link"
    ? (/^https:\/\/mfco\.link\/r\//.test(input.product.affiliate_url) && /#PR/.test(input.body + "\n" + replyFor(input.product, input.linkStrategy)) ? 10 : 0)
    : 0;
  const attentionOrDiscovery = role === "ATTENTION" || role === "DISCOVERY";
  const firstLineGateFailed = attentionOrDiscovery && !isDiscovery && readerCuriosity < 25;
  const discoveryInsight = discoveryInsightFor(input.product, input.quote, 0);
  const topicInsight = input.topicValue?.verdict === "PASS" ? discoveryInsightFromTopic(input.topicValue) : null;
  const discoveryFactMissing = input.postType === "ranking_note" && !topicInsight && !input.product.popularity_rank && input.product.likes_count <= 0 && input.product.saves_count <= 0 && !input.product.is_new && !input.quote;
  const discoveryConcrete = isDiscovery && (
    (Boolean(discoveryInsight) && input.body.includes(discoveryInsight?.line.split("。")[0] ?? ""))
    || /(新着なのに|新着で|人気[0-9０-９]+位|全体上位|中央値|同価格帯|いいね[0-9０-９,，]+に対して保存|X側で[0-9０-９]+万表示|X表示[0-9０-９,，]+|¥[0-9０-９,，]+)/.test(input.body)
    || Boolean(topicInsight && input.body.includes(topicInsight.line.split("。")[0] ?? ""))
  );
  const discoveryMethodTalk = isDiscovery && /(比較して見る|見て残す|反応と価格を見て|分析|判断材料|候補|条件を確認)/.test(input.body);
  const authorityValue = isAuthority && (/(今日残すなら|全体上位|中央値|同価格帯|verified visual|ここまで揃う|数字と見た目|先に見る理由|分かれ方|残った|もう一方は|要点|X側で[0-9０-９]+万表示|¥[0-9０-９,，]+)/.test(input.body) || Boolean(topicInsight && input.body.includes(topicInsight.line.split("。")[0] ?? ""))) && !/(探す手間を減らします|プロフィールにまとめます)$/m.test(input.body.trim());
  const revenueValid = isRevenue && isValidRevenueProduct(input.product) && /^https:\/\/mfco\.link\/r\//.test(input.product.affiliate_url);
  const genericPhrase = /(目立つ|気になる|見て残す|判断材料|刺さるポイント|入口がある)/g;
  const genericPhraseCount = input.body.match(genericPhrase)?.length ?? 0;
  const roleScoreRaw = isDiscovery
    ? ((discoveryConcrete ? 42 : 8) + (input.product.popularity_rank ? 14 : 0) + (input.product.is_new ? 12 : 0) + (input.product.likes_count >= 100 || input.product.saves_count >= 20 || topicInsight ? 16 : 0) + (naturalness >= 20 ? 12 : 7) + (genericPhraseCount === 0 ? 12 : 2))
    : isAuthority
      ? ((authorityValue ? 34 : 8) + (input.product.popularity_rank || input.product.is_new ? 14 : 8) + (input.product.likes_count > 0 || input.product.saves_count > 0 ? 12 : 7) + (naturalness >= 20 ? 18 : 10) + (genericPhraseCount === 0 ? 12 : 4) + 10)
      : isRevenue
        ? ((revenueValid ? 32 : 0) + (input.product.estimated_reward > 0 || input.product.reward_rate > 0 ? 18 : 0) + (input.product.popularity_rank || input.product.likes_count > 0 ? 14 : 8) + (/#PR/.test(input.body + "\n" + replyFor(input.product, input.linkStrategy)) ? 12 : 0) + (naturalness >= 20 ? 14 : 8) + (genericPhraseCount <= 1 ? 10 : 2))
        : 0;
  const roleScore = isDiscovery && (discoveryInsight || topicInsight) && !discoveryMethodTalk
    ? Math.max(roleScoreRaw, 90)
    : isAuthority && authorityValue
      ? Math.max(roleScoreRaw, 90)
    : roleScoreRaw;
  const v8QuoteScore = concreteVisualSpecificity + emotionalStopPower + visualTextFitV8 + naturalnessV8 + curiosityV8 + originalityV8;
  const legacyScore = readerCuriosity + concreteFact + visualTextFit + readerRelevance + originalAngle + naturalLanguage + salesAdminSmell + roleDifferentiation;
  const total = leak.hasLeak || hardFail.length
    ? 0
    : Math.max(0, Math.min(100, isQuote && hasVerifiedVisualAnalysis(input.quote)
      ? (
        (cueEarly && understanding.visualAnalysisStatus === "verified" ? 30 : 0)
        + emotionalStopPower
        + (concreteVisualSpecificity >= 22 ? 15 : 6)
        + naturalnessV8
        + curiosityV8
        + originality
      )
      : isQuote ? v8QuoteScore : role === "ATTENTION" ? legacyScore : roleScore));
  const quoteVisualMissing = isQuote && (!understanding.humanObservation || !cueInBody || !cueEarly);
  const quoteAttentionMissing = isQuote && hasVerifiedVisualAnalysis(input.quote) && (!understanding.attentionMoment || attentionValue.score < MYFANS_ATTENTION_VALUE_MINIMUM || attentionValue.weakCue);
  const abstractFallbackQuote = isQuote && understanding.visualAnalysisStatus !== "verified";
  const verifiedVisualNotGrounded = isQuote && hasVerifiedVisualAnalysis(input.quote) && (!cueInBody || understanding.visualAnalysisStatus !== "verified");
  const unverifiableVisualDetail = isQuote && !hasVerifiedVisualAnalysis(input.quote) && /(表情|ポーズ|構図|テロップ|字幕|アップ|引きの画|途中で|後半|冒頭と|距離が近くなる|1枚目|2枚目)/.test(input.body);
  const reportTone = isQuote && (reportWords.test(input.body) && !reactionWords.test(input.body));
  const abstractTextOnly = input.creativeStrategy === "text_only" && /この投稿|この切り取り|こういう|一回開いて|強い|気になる|刺さる/.test(input.body) && !/(人気|保存|新着|¥|価格|ランキング|プロフィール)/.test(input.body);
  const sourceSimilarity = sourceCopySimilarity(input.body, input.quote?.text_excerpt ?? "");
  const repeatedLine = (() => {
    const lines = input.body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return lines.length >= 2 && lines[0].replace(/[。！？!?]/g, "") === lines[1].replace(/[。！？!?]/g, "");
  })();
  const holdReasons = [
    leak.hasLeak ? `Public Copy leak: ${leak.matches.join(" / ")}` : "",
    ...hardFail.map((reason) => `Public Copy hard fail: ${reason}`),
    total < MYFANS_QUALITY_GATE_MINIMUM ? `Quality Gate ${MYFANS_QUALITY_GATE_MINIMUM}未満` : "",
    isQuote && concreteVisualSpecificity < 20 ? "concrete visual specificity 20/30未満" : "",
    verifiedVisualNotGrounded ? "verified visualなのに本文がvisual cueを反映していません" : "",
    unverifiableVisualDetail ? "未確認visual detailが本文に入っています" : "",
    firstLineGateFailed ? "First-line curiosity gate未達" : "",
    discoveryFactMissing ? "discovery差なし" : "",
    isDiscovery && !discoveryConcrete ? "DISCOVERYに実データ由来の一発見がありません" : "",
    discoveryMethodTalk ? "DISCOVERYが分析行為の説明になっています" : "",
    isAuthority && !authorityValue ? "AUTHORITYに編集者として何を選別したかがありません" : "",
    isRevenue && !revenueValid ? "Revenue枠の正規mfco.linkまたは報酬根拠がありません" : "",
    genericPhraseCount >= 2 ? "汎用句が多く機械的です" : "",
    quoteVisualMissing ? "quote本文に照合可能な具体visual cueがありません" : "",
    vagueReactionOnly ? "抽象リアクションだけで終わっています" : "",
    reportTone ? "quote本文が数字レポート口調です" : "",
    sourceSimilarity >= 0.72 ? "元投稿本文に近すぎます" : "",
    repeatedLine ? "本文内で同じ内容を繰り返しています" : "",
    quoteAttentionMissing ? `Attention Value ${MYFANS_ATTENTION_VALUE_MINIMUM}未満` : "",
    isQuote && weakAttentionCue(input.body) ? "事実でもhookとして弱いvisual cueです" : "",
    abstractFallbackQuote ? "verified visualなしの抽象fallback quoteは最終投稿に採用しません" : "",
    abstractTextOnly ? "抽象text onlyを4本埋めのために採用しません" : "",
    role === "ATTENTION" && input.creativeStrategy === "quote_post" && visualTextFit === 0 ? "引用visualがブラウザ表示確認済みではありません" : "",
    input.linkStrategy === "reply_link" && !isValidRevenueProduct(input.product) ? "Revenue枠の正規mfco.linkまたは報酬根拠がありません" : "",
  ].filter(Boolean);
  return {
    total: discoveryFactMissing ? Math.min(total, 84) : total,
    verdict: holdReasons.length ? "HOLD" : "PASS",
    breakdown: {
      stopPower: isQuote ? emotionalStopPower : readerCuriosity,
      firstLineStop: readerCuriosity,
      visualLeverage: isQuote && hasVerifiedVisualAnalysis(input.quote) ? (verifiedVisualNotGrounded ? 0 : 30) : isQuote ? visualTextFitV8 : visualTextFit,
      visual: isQuote ? visualTextFitV8 : visualTextFit,
      specificity: isQuote ? concreteVisualSpecificity : concreteFact,
      proof: concreteFact,
      broadCuriosity: isQuote ? curiosityV8 : originalAngle,
      audience: isQuote ? naturalnessV8 : readerRelevance,
      followReason: isQuote ? naturalness : readerRelevance,
      attentionValue: attentionValue.score,
      roleDifferentiation,
      spamSalesSmell: salesAdminSmell + naturalLanguage,
      repetitionPenalty: hardFail.length ? 100 : 0,
    },
    reasons: holdReasons.length ? holdReasons : [`${role} role別Quality Gateで公開可能です`],
  };
}

export function evaluateMyfansPublicCopyQuality(input: {
  body: string;
  product: MyfansProduct;
  postType: string;
  linkStrategy: MyfansLinkStrategy;
  creativeStrategy: MyfansCreativeStrategy;
  quote: MyfansQuoteCandidate | null;
  hook?: HookType;
  attentionScore?: number;
}) {
  return qualityScoreFor({
    body: input.body,
    product: input.product,
    postType: input.postType,
    linkStrategy: input.linkStrategy,
    creativeStrategy: input.creativeStrategy,
    quote: input.quote,
    hook: input.hook ?? "STRONG_VISUAL",
    attentionScore: input.attentionScore ?? 90,
  });
}

function sourceCopySimilarity(body: string, sourceText: string) {
  const sourceTokens = sourceText.replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter((token) => token.length >= 2);
  const bodyText = body.replace(/[^\p{L}\p{N}]+/gu, " ");
  if (sourceTokens.length < 3) return 0;
  const copied = sourceTokens.filter((token) => bodyText.includes(token)).length;
  return copied / sourceTokens.length;
}

const PUBLIC_COPY_LEAK_PATTERNS = [
  /browser/i,
  /visual表示/i,
  /検証|検証済み|確認済み候補/,
  /候補|公開候補/,
  /推定報酬|報酬率|expected reward|reward rate|affiliate economics/i,
  /Quality Gate|PASS|HOLD/i,
  /登録情報/,
  /正規URLと報酬条件/,
  /弱いvisual|visualは弱い/i,
  /システム|選定ルール|内部/,
  /止まりやすい|探す時間を減らしたい|反応と価格のズレ|判断材料|比較して見|好き嫌いが.*分かれ|〜向け|向けに/,
  /数字だけ浮いて見える|反応の強さが目に入る|数字の伸び方|同価格帯なら先に気になる|この反応は目立つ/,
  /validation|estimated reward|reward|audience intent|attention reason/i,
];

export function detectPublicCopyLeak(text: string) {
  const matches = PUBLIC_COPY_LEAK_PATTERNS.flatMap((pattern) => {
    const found = text.match(pattern);
    return found?.[0] ? [found[0]] : [];
  });
  return { hasLeak: matches.length > 0, matches };
}

function publicCopyHardFail(text: string) {
  const rules: Array<[RegExp, string]> = [
    [/myfansアフィリエイト|X側で|単独の条件より/, "内部視点の公開文"],
    [/候補|判断|判断材料|確認済み|検証|検証済み|選定|分析|管理|内部|システム/, "内部判断語彙"],
    [/向けに|向けの|好き嫌いが|止まりやすい投稿|探す手間|探す時間|反応と価格のズレ|残す/, "管理者説明の露出"],
    [/表示[0-9０-９,，.．]+\s*\/\s*(いいね|RP)|いいね[0-9０-９,，.．]+\s*\/\s*(表示|RP)/, "metrics slash羅列"],
    [/^¥[0-9０-９,，.．]+.*(目立つ|反応|気になる)/m, "価格だけのhook"],
    [/数字だけ浮いて見える|反応の強さが目に入る|数字の伸び方|同価格帯なら先に気になる|この反応は目立つ|見ると印象が変わる|全体上位まで伸びた/, "v6数字分析表現"],
    [/報酬|reward|validation|Quality Gate|audience intent|Attention|visual/i, "system/reward語彙"],
    [/これ強い|一回止まる|見返したくなる|刺さるポイント|入口がある|入口がはっきり|こういう分かりやすい引き|分かりやすいから、知らなくても入りやすい/, "vague reaction phrase"],
    [/要素から入る|構図だけで空気が(だいぶ)?伝わる|から[^。！？!?]{0,18}が出る|で先に引けてる|分かりやすさで/, "v10自然文hard fail"],
    [/白いプロフィール画面|白っぽい部屋で動き出す|目に残る|目に入る、地味に強い|説明が少なくても手が止まる/, "low attention visual cue"],
    [/空気が(だいぶ)?伝わる|先を見たくなる|続きが気になる|引けてる|分かりやすさ|流れてきた理由がある|比べた時の違いが残る|方向性が分かる|方向性がはっきり|何が違うか分からない/, "汎用抽象結論"],
    [/^.*向け/m, "audience label起点"],
  ];
  return rules.flatMap(([pattern, reason]) => pattern.test(text) ? [reason] : []);
}

function machineLikeCopyIssue(text: string) {
  if ((text.match(/です。|ます。/g) ?? []).length >= 2) return "ですます調の反復";
  if ((text.match(/人なら/g) ?? []).length >= 1) return "読者ラベルの直書き";
  if ((text.match(/数字|反応|比較|発見|条件/g) ?? []).length >= 5) return "抽象語の連打";
  if (/理由がある|違いが残る|方向性が分かる|方向性がはっきり/.test(text)) return "具体差のない抽象結論";
  if (/数字[\s\S]*解説[\s\S]*(プロフィール|自己リプ|詳細)/.test(text)) return "数字＋解説＋CTAテンプレ";
  return "";
}

function normalizedTemplateLine(text: string) {
  return text
    .split(/\n+/)[0]
    .replace(/[0-9０-９,，.．]+/g, "0")
    .replace(/¥0/g, "¥")
    .replace(/(表示|いいね|保存|人気|RP)0/g, "$10")
    .replace(/\s+/g, "")
    .slice(0, 34);
}

function endingTone(text: string) {
  const compact = text.replace(/\s+/g, "");
  return compact.slice(-8);
}

function hasPublicCopyDiversityIssue(body: string, previousBodies: string[]) {
  const first = normalizedTemplateLine(body);
  const ending = endingTone(body);
  const lines = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const previous of previousBodies) {
    const previousFirst = normalizedTemplateLine(previous);
    const previousLines = previous.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (first && first === previousFirst) return "同じ1行目構文が続いています";
    if (lines.some((line) => line.length >= 12 && previousLines.includes(line))) return "同じ文が別投稿にも出ています";
    for (const phrase of ["地味に強い", "説明が少なくても手が止まる", "盛って言わなくても", "逆に気になる"]) {
      if (body.includes(phrase) && previous.includes(phrase)) return `同じreaction phraseが別投稿にも出ています: ${phrase}`;
    }
    if (ending && ending === endingTone(previous) && first.slice(0, 8) === previousFirst.slice(0, 8)) return "同じ語尾が続いています";
    const metricTemplate = /表示[0-9,]+\/いいね[0-9,]+/.test(body.replace(/\s+/g, "")) && /表示[0-9,]+\/いいね[0-9,]+/.test(previous.replace(/\s+/g, ""));
    if (metricTemplate && first.slice(0, 6) === previousFirst.slice(0, 6)) return "数字テンプレの見え方が近すぎます";
  }
  if ((body.match(/します/g) ?? []).length >= 2) return "宣言文の連発が残っています";
  return "";
}

function holdQuality(quality: ReturnType<typeof qualityScoreFor>, reason: string) {
  return {
    ...quality,
    verdict: "HOLD",
    total: Math.min(quality.total, 84),
    reasons: [...quality.reasons.filter((item) => item !== "公開可能な具体性と根拠があります"), reason],
  };
}

function readerValueFor(postType: string, product: MyfansProduct) {
  const audience = inferAudience(product);
  if (postType === "ranking_note") return `${audience}が、価格や反応数を比較材料にできる。`;
  if (postType === "profile_cta" || postType === "comparison_review") return `${audience}が、自分向きか先に切り分けられる。`;
  if (postType === "reply_link_sales" || postType === "body_link_sales") return `${audience}が、リンク前に見る理由だけ確認できる。`;
  return `${audience}が、流す前に気になる点を一つ持ち帰れる。`;
}

function roleFor(postType: string, linkStrategy: MyfansLinkStrategy, creativeStrategy: MyfansCreativeStrategy): DailyRole {
  if (creativeStrategy === "quote_post") return "ATTENTION";
  if (linkStrategy === "reply_link" || linkStrategy === "body_link" || postType === "reply_link_sales" || postType === "body_link_sales") return "REVENUE";
  if (postType === "ranking_note" || creativeStrategy === "ranking_card" || creativeStrategy === "discovery_card") return "DISCOVERY";
  if (postType === "profile_cta" || postType === "comparison_review" || creativeStrategy === "comparison_card") return "AUTHORITY";
  return "DISCOVERY";
}

function discoveryInsightFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, variant = 0) {
  const rank = product.popularity_rank;
  const likes = product.likes_count;
  const saves = product.saves_count;
  const quoteLikes = quote?.likes ?? 0;
  const quoteViews = quote?.views ?? 0;
  const rows = [
    product.is_new && (likes >= 80 || saves >= 20)
      ? { score: 96, line: `新着なのに、いいね${likes.toLocaleString("ja-JP")}まで伸びている。`, value: "新着の中で反応が先に立っている。" }
      : null,
    rank && rank <= 10 && likes >= 50
      ? { score: 94, line: `人気${rank}位で、いいねも${likes.toLocaleString("ja-JP")}まで乗っている。`, value: "順位だけでなく反応も伴っている。" }
      : null,
    saves >= 20 && likes >= 80
      ? { score: 92, line: `いいね${likes.toLocaleString("ja-JP")}に対して保存${saves.toLocaleString("ja-JP")}が強い。`, value: "流し見より、あとで戻る反応がある。" }
      : null,
    quoteViews >= 50_000 && quoteLikes >= 1000
      ? { score: 91, line: `X側で${Math.floor(quoteViews / 10_000)}万表示を超えて、いいねも${quoteLikes.toLocaleString("ja-JP")}まで出ている。`, value: "myfans外でも引きが確認できる。" }
      : null,
    product.price >= 3980 && /顔|晒し|インフルエンサー|女王様|本編/.test(product.title)
      ? { score: 90, line: `¥${product.price.toLocaleString("ja-JP")}なので、軽く試すより目的がはっきりした人向き。`, value: "価格が高めでも、内容の方向性が先に分かる。" }
      : null,
    product.price > 0 && product.price <= 1500
      ? { score: 90, line: `¥${product.price.toLocaleString("ja-JP")}なら、入口としては軽い。`, value: "価格が判断に効く日だけ、先に見ておける。" }
      : null,
    product.price > 0 && product.price <= 1200 && (rank || likes >= 100)
      ? { score: 90, line: `¥${product.price.toLocaleString("ja-JP")}で、反応が先に立っている。`, value: "価格だけでなく反応が付いている時だけ見る価値がある。" }
      : null,
  ].filter(Boolean) as Array<{ score: number; line: string; value: string }>;
  if (!rows.length) return null;
  return rows[(variant + stableHash(`${product.id}:${likes}:${saves}:${rank ?? 0}`)) % rows.length];
}

function median(values: number[]) {
  const rows = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : Math.round((rows[mid - 1] + rows[mid]) / 2);
}

function percentileRank(value: number, values: number[]) {
  const rows = values.filter((item) => Number.isFinite(item)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const belowOrEqual = rows.filter((item) => item <= value).length;
  return Math.round((belowOrEqual / rows.length) * 100);
}

function priceBucket(price: number) {
  if (price <= 0) return "unknown";
  if (price <= 1500) return "low";
  if (price <= 3980) return "mid";
  return "high";
}

type MyfansTopicBaselines = {
  creatorMedianLikes: Map<string, number>;
  creatorMedianSaves: Map<string, number>;
  priceBucketMedianLikes: Map<string, number>;
  genreMedianLikes: Map<string, number>;
  allLikes: number[];
  allQuoteViews: number[];
  allQuoteLikes: number[];
};

function buildTopicBaselines(analytics: MyfansAnalytics): MyfansTopicBaselines {
  const products = analytics.products.filter((product) => product.status !== "paused" && product.status !== "rejected");
  const creatorLikes = new Map<string, number[]>();
  const creatorSaves = new Map<string, number[]>();
  const bucketLikes = new Map<string, number[]>();
  const genreLikes = new Map<string, number[]>();
  for (const product of products) {
    const creatorKey = creatorKeyFromProduct(product);
    creatorLikes.set(creatorKey, [...(creatorLikes.get(creatorKey) ?? []), product.likes_count]);
    creatorSaves.set(creatorKey, [...(creatorSaves.get(creatorKey) ?? []), product.saves_count]);
    const bucket = priceBucket(product.price);
    bucketLikes.set(bucket, [...(bucketLikes.get(bucket) ?? []), product.likes_count]);
    if (product.genre) genreLikes.set(product.genre, [...(genreLikes.get(product.genre) ?? []), product.likes_count]);
  }
  const toMedianMap = (source: Map<string, number[]>) => new Map(Array.from(source.entries()).flatMap(([key, values]) => {
    const value = median(values);
    return value === null ? [] : [[key, value]];
  }));
  return {
    creatorMedianLikes: toMedianMap(creatorLikes),
    creatorMedianSaves: toMedianMap(creatorSaves),
    priceBucketMedianLikes: toMedianMap(bucketLikes),
    genreMedianLikes: toMedianMap(genreLikes),
    allLikes: products.map((product) => product.likes_count),
    allQuoteViews: analytics.quoteCandidates.map((quote) => quote.views ?? 0),
    allQuoteLikes: analytics.quoteCandidates.map((quote) => quote.likes ?? 0),
  };
}

function topicThresholdFor(role: DailyRole) {
  return MYFANS_TOPIC_VALUE_THRESHOLDS[role];
}

export function evaluateMyfansTopicValue(input: {
  product: MyfansProduct;
  quote: MyfansQuoteCandidate | null;
  role: DailyRole;
  baselines: MyfansTopicBaselines;
}): MyfansTopicValue {
  const { product, quote, role, baselines } = input;
  const creatorKey = creatorKeyFromProduct(product);
  const creatorMedianLikes = baselines.creatorMedianLikes.get(creatorKey) ?? null;
  const creatorMedianSaves = baselines.creatorMedianSaves.get(creatorKey) ?? null;
  const bucketMedianLikes = baselines.priceBucketMedianLikes.get(priceBucket(product.price)) ?? null;
  const genreMedianLikes = product.genre ? baselines.genreMedianLikes.get(product.genre) ?? null : null;
  const productLikePercentile = percentileRank(product.likes_count, baselines.allLikes);
  const quoteViewPercentile = quote ? percentileRank(quote.views ?? 0, baselines.allQuoteViews) : null;
  const quoteLikePercentile = quote ? percentileRank(quote.likes ?? 0, baselines.allQuoteLikes) : null;
  const visual = quote ? visualUnderstandingFor(publicCopyFactsFor(product, quote)) : null;
  const evidence: string[] = [];
  const baseline: string[] = [];
  const reasons: MyfansReasonToCare[] = [];

  if (creatorMedianLikes !== null) baseline.push(`creator median likes ${creatorMedianLikes} vs current ${product.likes_count}`);
  if (creatorMedianSaves !== null) baseline.push(`creator median saves ${creatorMedianSaves} vs current ${product.saves_count}`);
  if (bucketMedianLikes !== null) baseline.push(`price bucket ${priceBucket(product.price)} median likes ${bucketMedianLikes} vs current ${product.likes_count}`);
  if (genreMedianLikes !== null) baseline.push(`genre median likes ${genreMedianLikes} vs current ${product.likes_count}`);
  if (quoteViewPercentile !== null) baseline.push(`quote views percentile ${quoteViewPercentile}`);

  if (creatorMedianLikes !== null && product.likes_count >= Math.max(80, creatorMedianLikes * 2)) {
    reasons.push("creator_outlier");
    evidence.push(`creator通常中央値${creatorMedianLikes}いいねに対して今回${product.likes_count}いいね`);
  }
  if (bucketMedianLikes !== null && product.likes_count >= Math.max(80, bucketMedianLikes * 1.8)) {
    reasons.push("clear_comparison");
    evidence.push(`同価格帯中央値${bucketMedianLikes}いいねに対して今回${product.likes_count}いいね`);
  }
  if (product.popularity_rank && product.popularity_rank <= 10 && product.likes_count >= 100 && productLikePercentile !== null && productLikePercentile >= 50) {
    reasons.push("ranking_anomaly");
    evidence.push(`人気${product.popularity_rank}位で、いいねも全体上位${productLikePercentile}%`);
  }
  if (product.is_new && productLikePercentile !== null && productLikePercentile >= 75) {
    reasons.push("unexpected_popularity");
    evidence.push(`新着で、いいねが全体上位${productLikePercentile}%`);
  }
  if (quote && (quoteViewPercentile ?? 0) >= 85 && (quote.views ?? 0) >= 50_000) {
    reasons.push("rapid_growth");
    evidence.push(`X表示${(quote.views ?? 0).toLocaleString("ja-JP")}で全体上位${quoteViewPercentile}%`);
  }
  if (quote && (quoteLikePercentile ?? 0) >= 85 && (quote.likes ?? 0) >= 1000) {
    reasons.push("unexpected_popularity");
    evidence.push(`Xいいね${(quote.likes ?? 0).toLocaleString("ja-JP")}で全体上位${quoteLikePercentile}%`);
  }
  if (visual?.visualAnalysisStatus === "verified" && visual.attentionMoment && !weakAttentionCue(visual.attentionMoment) && visual.attentionValue.score >= MYFANS_ATTENTION_VALUE_MINIMUM) {
    reasons.push(visual.visibleChangeOrContrast ? "visual_gap" : "rare_visual_moment");
    evidence.push(`verified visual: ${visual.attentionMoment}`);
  }
  if (product.price > 0 && bucketMedianLikes !== null && product.likes_count >= Math.max(80, bucketMedianLikes * 1.8)) {
    reasons.push("price_anomaly");
    evidence.push(`価格${product.price.toLocaleString("ja-JP")}円で同価格帯より反応が突出`);
  }

  const hasComparison = evidence.some((item) => /中央値|上位|同価格帯|通常/.test(item));
  const hasVisualEvidence = evidence.some((item) => item.startsWith("verified visual"));
  const surprise = Math.min(20, (hasComparison ? 12 : 0) + (product.is_new && hasComparison ? 5 : 0) + (quoteViewPercentile !== null && quoteViewPercentile >= 90 ? 3 : 0));
  const concreteDifference = Math.min(20, (creatorMedianLikes !== null && product.likes_count > creatorMedianLikes ? 8 : 0) + (bucketMedianLikes !== null && product.likes_count > bucketMedianLikes ? 8 : 0) + (product.popularity_rank && product.popularity_rank <= 10 ? 4 : 0));
  const humanCuriosity = Math.min(20, (hasVisualEvidence ? 12 : 0) + (hasComparison ? 6 : 0) + (product.title.length >= 8 ? 2 : 0));
  const socialProofMomentum = Math.min(15, ((quote?.views ?? 0) >= 50_000 ? 6 : 0) + ((quote?.likes ?? 0) >= 1000 ? 5 : 0) + (product.likes_count >= 80 ? 4 : 0));
  const visualStoryValue = Math.min(15, hasVisualEvidence ? 15 : quote && hasBrowserVisibleVisual(quote) ? 8 : 0);
  const explainability = Math.min(10, evidence.length ? 10 : 0);
  let score = surprise + concreteDifference + humanCuriosity + socialProofMomentum + visualStoryValue + explainability;
  if (reasons.includes("ranking_anomaly")) score = Math.max(score, 82);
  if (reasons.includes("creator_outlier") || reasons.includes("clear_comparison")) score = Math.max(score, 84);
  if (reasons.includes("rapid_growth") || reasons.includes("visual_gap") || reasons.includes("rare_visual_moment")) score = Math.max(score, 86);
  if (role === "AUTHORITY" && evidence.length >= 2) score = Math.min(100, score + 8);
  const priceOnly = product.price > 0 && !hasComparison && !hasVisualEvidence;
  const metricsOnly = !hasComparison && !hasVisualEvidence && (product.likes_count > 0 || product.saves_count > 0 || product.popularity_rank);
  const visualJoined = visual ? [
    visual.attentionMoment,
    visual.humanObservation,
    visual.concreteVisualCue,
    visual.rawVisualEvidence,
  ].join(" ") : "";
  const weakBackgroundOnly = visual && (
    /白い部屋|白っぽい部屋|プロフィール画面|タイトル|条件/.test(visualJoined) &&
    !/くま|踊|青|赤|黒|ランジェリー|向かい合|近さ|近め|全身|制服|階段|表情|切り替わ|変わる/.test(visualJoined)
  );
  const whyRejected = [
    priceOnly ? "価格単独で比較根拠なし" : "",
    metricsOnly ? "数字単独でbaseline差なし" : "",
    weakBackgroundOnly && !hasComparison ? "背景/プロフィール/距離感だけで話す価値が弱い" : "",
    !reasons.length ? "reason_to_careを根拠付きで選べません" : "",
  ].filter(Boolean);
  if (whyRejected.length) score = Math.min(score, 74);
  const threshold = topicThresholdFor(role);
  const verdict = score >= threshold && reasons.length && evidence.length && !whyRejected.length ? "PASS" : "LOW_TOPIC_VALUE";
  return {
    score,
    verdict,
    reasonToCare: verdict === "PASS" ? reasons[0] : null,
    evidence,
    baseline,
    whyRejected: verdict === "PASS" ? [] : (whyRejected.length ? whyRejected : [`Topic Value ${threshold}未満`]),
    breakdown: { surprise, concreteDifference, humanCuriosity, socialProofMomentum, visualStoryValue, explainability },
  };
}

function discoveryInsightFromTopic(topicValue: MyfansTopicValue) {
  const evidence = topicValue.evidence[0] ?? "";
  if (!topicValue.reasonToCare || !evidence) return null;
  const quoteViews = evidence.match(/X表示([0-9,，]+)/)?.[1]?.replace(/[，,]/g, "");
  if ((topicValue.reasonToCare === "rapid_growth" || topicValue.reasonToCare === "unexpected_popularity") && quoteViews) {
    const views = Number(quoteViews);
    const viewLine = Number.isFinite(views) && views >= 10_000
      ? `${Math.floor(views / 10_000)}万回も見られているなら、流れてきた理由がある。`
      : evidence;
    return { line: viewLine, value: "桁だけで押さず、元投稿の場面まで確認できる時だけ使いたい。" };
  }
  if (topicValue.reasonToCare === "creator_outlier") return { line: evidence.replace(/^creator/, "creator"), value: "普段との差が見えるから、ただの新着より先に引っかかる。" };
  if (topicValue.reasonToCare === "clear_comparison" || topicValue.reasonToCare === "price_anomaly") return { line: evidence, value: "価格だけではなく、同じ条件の中で反応が違う。" };
  if (topicValue.reasonToCare === "ranking_anomaly") return { line: evidence, value: "順位だけでなく、反応まで一緒に上がっている。" };
  if (topicValue.reasonToCare === "rapid_growth" || topicValue.reasonToCare === "unexpected_popularity") return { line: evidence, value: "数字だけでなく、元投稿の見せ場まで見えてから出したい。" };
  if (topicValue.reasonToCare === "visual_gap" || topicValue.reasonToCare === "rare_visual_moment") return { line: evidence.replace(/^verified visual: /, ""), value: "数字より先に、見た瞬間の違いがある。" };
  return { line: evidence, value: "単なる条件ではなく、見た人が話せる差がある。" };
}

function metricBand(value: number | null | undefined) {
  if (!value || value <= 0) return "";
  if (value >= 1_000_000) return `${Math.round(value / 100_000) * 10}万`;
  if (value >= 100_000) return `${Math.round(value / 10_000)}万`;
  if (value >= 10_000) return `${Math.round(value / 1000)}千`;
  return `${Math.round(value / 100) * 100}`;
}

function topicIdentityFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, reasonToCare: MyfansReasonToCare | null | undefined) {
  if (quote?.id) return `quote:${quote.id}`;
  if (quote?.x_post_url) return `source:${quote.x_post_url.toLowerCase()}`;
  if (reasonToCare === "creator_outlier") return `${creatorKeyFromProduct(product)}:creator-outlier`;
  if (reasonToCare === "ranking_anomaly") return `product:${product.id}:ranking-anomaly:${product.popularity_rank ?? "none"}`;
  if (reasonToCare === "clear_comparison" || reasonToCare === "price_anomaly") return `product:${product.id}:${reasonToCare}:${priceBucket(product.price)}`;
  return `product:${product.id}:${reasonToCare ?? "topic"}`;
}

function topicSemanticKeyFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null | undefined) {
  const reason = topicValue?.reasonToCare ?? "unknown";
  if (quote) {
    const views = metricBand(quote.views);
    const likes = metricBand(quote.likes);
    const source = (() => {
      try {
        return quote.x_post_url ? new URL(quote.x_post_url).pathname.toLowerCase() : `quote-${quote.id}`;
      } catch {
        return quote.x_post_url?.toLowerCase() || `quote-${quote.id}`;
      }
    })();
    return [`quote-event`, source, views ? `views:${views}` : "", likes ? `likes:${likes}` : ""].filter(Boolean).join(":");
  }
  if (reason === "creator_outlier") return `${creatorKeyFromProduct(product)}:creator-outlier`;
  if (reason === "ranking_anomaly") return `ranking:${product.popularity_rank ?? "none"}:${product.genre}`;
  if (reason === "clear_comparison" || reason === "price_anomaly") return `comparison:${priceBucket(product.price)}:${metricBand(product.likes_count)}`;
  return `product:${product.id}:${reason}`;
}

function semanticTopicSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftParts = new Set(left.split(/[:/|]+/).filter((part) => part.length >= 3));
  const rightParts = right.split(/[:/|]+/).filter((part) => part.length >= 3);
  if (!leftParts.size || !rightParts.length) return 0;
  const overlap = rightParts.filter((part) => leftParts.has(part)).length;
  return overlap / Math.max(leftParts.size, rightParts.length);
}

function buildDiscoveryCopy(product: MyfansProduct, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null, variant = 0) {
  const insight = topicValue?.verdict === "PASS" ? discoveryInsightFromTopic(topicValue) : null;
  if (!insight) return ["話す価値の根拠が弱いので今日は出さない。"];
  const closers = [insight.value, "数字だけで押さず、見えた場面まで残しておきたい。", "伸びた投稿でも、何が見えたかまで確認してから拾う。"];
  return [insight.line, closers[variant % closers.length]];
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
    `単独の条件より、${insight.line}`,
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

function stopReasonFor(postType: string, product: MyfansProduct) {
  const angle = inferAngle(product);
  if (postType === "ranking_note") return "価格や順位などの数字を先頭に置き、比較目的の読者を止める。";
  if (postType === "profile_cta") return `自己紹介ではなく「${angle}」という判断軸から入る。`;
  if (postType === "reply_link_sales" || postType === "body_link_sales") return "売り込み前に、合う人だけ分かる具体条件を置く。";
  return `「${angle}」という好みの分かれ目を最初に見せる。`;
}

const QUOTE_FRESH_DAYS = 7;
const QUOTE_REFRESH_DAYS = 3;
const QUOTE_MIN_SCORE = 55;
const QUOTE_STRONG_SCORE = 78;
const QUOTE_CREATOR_COOLDOWN_DAYS = 2;

function addDaysIso(value: string | null | undefined, days: number) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function daysSinceIso(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 86_400_000);
}

function creatorKeyFromProduct(product: MyfansProduct) {
  return product.creator_id ? `creator:${product.creator_id}` : `x:${(product.creator_x_url ?? "").toLowerCase()}`;
}

function creatorKeyFromCreator(creator: MyfansAnalytics["creators"][number]) {
  return `creator:${creator.id}`;
}

function creatorKeyFromQuote(candidate: MyfansQuoteCandidate) {
  return candidate.creator_id ? `creator:${candidate.creator_id}` : `x:${candidate.creator_x_url.toLowerCase()}`;
}

function quoteUrlFromCandidate(candidate: MyfansQuoteCandidate) {
  return candidate.quote_visual_ready && candidate.media_permalink ? candidate.media_permalink : candidate.x_post_url;
}

function visualPriority(candidate: MyfansQuoteCandidate) {
  const analysis = visualAnalysisForQuote(candidate);
  if (hasBrowserVisibleVisual(candidate) && analysis?.status === "verified") return 4;
  if (hasBrowserVisibleVisual(candidate) && analysis?.status === "partial") return 3;
  if (hasBrowserVisibleVisual(candidate)) return 2;
  if (candidate.has_video || candidate.has_image) return 1;
  return 0;
}

function recentUsedCreatorKeys(analytics: MyfansAnalytics) {
  const cutoff = cutoffIso(QUOTE_CREATOR_COOLDOWN_DAYS);
  const keys = new Set<string>();
  for (const post of analytics.posts) {
    if (post.creative_strategy !== "quote_post" || !post.quote_x_url || !((post.posted_at ?? post.created_at) >= cutoff)) continue;
    const product = analytics.products.find((item) => item.id === post.product_id);
    if (product) keys.add(creatorKeyFromProduct(product));
  }
  return keys;
}

function usedQuoteUrls(analytics: MyfansAnalytics) {
  const urls = new Set<string>();
  for (const post of analytics.posts) {
    if (post.creative_strategy === "quote_post" && post.quote_x_url) urls.add(post.quote_x_url);
  }
  return urls;
}

export function buildMyfansQuotePool(analytics: MyfansAnalytics) {
  const recentCreators = recentUsedCreatorKeys(analytics);
  const usedUrls = usedQuoteUrls(analytics);
  const creatorLastUsed = new Map<string, string>();
  for (const post of analytics.posts) {
    if (post.creative_strategy !== "quote_post") continue;
    const product = analytics.products.find((item) => item.id === post.product_id);
    if (!product) continue;
    const key = creatorKeyFromProduct(product);
    const usedAt = post.posted_at ?? post.created_at;
    if (usedAt && (!creatorLastUsed.has(key) || usedAt > String(creatorLastUsed.get(key)))) creatorLastUsed.set(key, usedAt);
  }
  const now = new Date().toISOString();
  const sourceTotal = analytics.quoteCandidateSource.dbCount;
  const sourceLoaded = analytics.quoteCandidateSource.loadedCount;
  const mediaScoped = analytics.quoteCandidates.length;
  const baseEligible = analytics.quoteCandidates.filter((candidate) => {
    const age = daysSinceIso(candidate.collected_at);
    if (age !== null && age > QUOTE_FRESH_DAYS) return false;
    if (candidate.is_repost) return false;
    if (candidate.cooldown_until && candidate.cooldown_until > now) return false;
    if (usedUrls.has(candidate.x_post_url) || usedUrls.has(quoteUrlFromCandidate(candidate)) || candidate.last_used_at) return false;
    return true;
  });
  const qualified = baseEligible.filter((candidate) =>
    hasBrowserVisibleVisual(candidate) &&
    ((candidate.creator_rank ?? 99) <= 3 || hasVerifiedVisualAnalysis(candidate)) &&
    candidate.score >= QUOTE_MIN_SCORE,
  );
  const scoredGlobal = qualified
    .map((candidate) => {
      const key = creatorKeyFromQuote(candidate);
      const freshnessAge = daysSinceIso(candidate.collected_at) ?? QUOTE_FRESH_DAYS;
      const unusedDays = daysSinceIso(creatorLastUsed.get(key)) ?? 30;
      const visual = visualPriority(candidate);
      const visualBoost = visual === 4 ? 45 : visual === 3 ? 24 : visual === 2 ? 8 : visual === 1 ? -18 : -28;
      const globalScore = Math.round(Math.max(0, Math.min(120,
        candidate.score
        + visualBoost
        + Math.max(0, 10 - freshnessAge)
        + Math.min(8, unusedDays / 3)
        - (recentCreators.has(key) ? 18 : 0)
        - Math.max(0, (candidate.use_count ?? 0) * 12)
        - ((candidate.creator_rank ?? 3) - 1) * 4,
      )));
      return { candidate, globalScore };
    })
    .sort((a, b) =>
      b.globalScore - a.globalScore ||
      visualPriority(b.candidate) - visualPriority(a.candidate) ||
      b.candidate.score - a.candidate.score
    );
  const global: typeof scoredGlobal = [];
  const creatorCounts = new Map<string, number>();
  for (const row of scoredGlobal) {
    const key = creatorKeyFromQuote(row.candidate);
    const count = creatorCounts.get(key) ?? 0;
    if (global.length < 3 && count >= 2) continue;
    global.push(row);
    creatorCounts.set(key, count + 1);
  }
  for (const row of scoredGlobal) {
    if (global.includes(row)) continue;
    global.push({ ...row, globalScore: Math.max(0, row.globalScore - 35) });
  }
  const selected: typeof global = [];
  const selectedCreators = new Set<string>();
  for (const row of global) {
    const key = creatorKeyFromQuote(row.candidate);
    const visual = visualPriority(row.candidate);
    if (selectedCreators.has(key)) continue;
    if (selected.length === 0 && visual >= 2 && row.globalScore >= QUOTE_MIN_SCORE) {
      selected.push(row);
      selectedCreators.add(key);
      continue;
    }
    if (selected.length === 1 && visual >= 2 && row.globalScore >= QUOTE_STRONG_SCORE) {
      selected.push(row);
      selectedCreators.add(key);
    }
    if (selected.length >= 2) break;
  }
  const attentionShortlistCount = global.filter((row) => row.globalScore >= QUOTE_MIN_SCORE).slice(0, 10).length;
  return {
    global,
    selected,
    funnel: {
      dbTotal: sourceTotal,
      loaded: sourceLoaded,
      mediaScoped,
      baseEligible: baseEligible.length,
      qualified: qualified.length,
      attentionShortlist: attentionShortlistCount,
      selected: selected.length,
      loadedAll: analytics.quoteCandidateSource.loadedAll,
      latestCollectedAt: analytics.quoteCandidateSource.latestCollectedAt,
      pageSize: analytics.quoteCandidateSource.pageSize,
    },
  };
}

function hasPermittedMedia(product: MyfansProduct) {
  return ["permitted_image", "permitted_video", "permitted_image_video"].includes(product.media_permission_status ?? "");
}

function decideCreativeStrategy(product: MyfansProduct, postType: string, linkStrategy: MyfansLinkStrategy, quoteXUrlOverride = ""): {
  strategy: MyfansCreativeStrategy;
  reason: string;
  instruction: string;
  ogpCheckRequired: boolean;
  quoteXUrl: string;
} {
  const quoteXUrl = quoteXUrlOverride;
  if ((postType === "discovery_interest" || postType === "profile_cta" || postType === "comparison_review") && quoteXUrl) {
    return {
      strategy: "quote_post",
      reason: "creator本人のX投稿を独立したGrowth Topicとして使うため。",
      instruction: "creator本人のX投稿を引用します。本文に元投稿本文は再掲しません。",
      ogpCheckRequired: false,
      quoteXUrl,
    };
  }
  if (hasPermittedMedia(product)) {
    return {
      strategy: "permitted_media",
      reason: "creator個別許諾が登録されているため。許諾メモの範囲外では使いません。",
      instruction: "許諾メモを確認し、その範囲の画像/動画だけを添付します。",
      ogpCheckRequired: false,
      quoteXUrl: "",
    };
  }
  if (linkStrategy === "reply_link" && product.affiliate_url) {
    return {
      strategy: "myfans_ogp",
      reason: "Revenue枠は正規mfco.linkを自己リプに置き、myfans側の正規OGP表示を使うため。",
      instruction: "本投稿はフックだけ出し、自己リプに#PRとmfco.linkを貼ります。X上でOGP表示を確認します。",
      ogpCheckRequired: true,
      quoteXUrl: "",
    };
  }
  if (linkStrategy === "body_link" && product.affiliate_url) {
    return {
      strategy: "myfans_ogp",
      reason: "本文リンク検証では正規mfco.linkのOGP表示を確認できるため。",
      instruction: "X投稿画面でOGPが出ることを確認し、出ない場合は自己リプ型へ切り替えます。",
      ogpCheckRequired: true,
      quoteXUrl: "",
    };
  }
  if (postType === "ranking_note") {
    const story = dataStoryScore(product);
    if (story.score < 60) {
      return {
        strategy: "text_only",
        reason: `CARD NOT RECOMMENDED: Data Story Score ${story.score}/100。${story.reasons.length ? story.reasons.join(" / ") : "一目で伝わる順位差・価格差・反応差が不足"}。`,
        instruction: "カードは作らずtext onlyで発見の意味だけを出します。",
        ogpCheckRequired: false,
        quoteXUrl: "",
      };
    }
    return {
      strategy: "ranking_card",
      reason: `CARD RECOMMENDED: Data Story Score ${story.score}/100。${story.reasons.join(" / ")}を1枚で見せられるため。`,
      instruction: "カードを生成して添付します。作品画像/動画は取り込みません。",
      ogpCheckRequired: false,
      quoteXUrl: "",
    };
  }
  if (postType === "discovery_interest") {
    const story = dataStoryScore(product);
    if (story.score < 60) {
      return {
        strategy: "text_only",
        reason: `CARD NOT RECOMMENDED: Data Story Score ${story.score}/100。カード化しても注目理由が強くなりません。`,
        instruction: "画像カードは使わず、本文の具体的な発見で反応を見ます。",
        ogpCheckRequired: false,
        quoteXUrl: "",
      };
    }
    return {
      strategy: "discovery_card",
      reason: quoteXUrl
        ? "creator本人のX投稿URLは候補として残しつつ、初見の発見枠は無断素材なしのテキストカードで止めるため。"
        : "引用元がない発見枠でも、条件カードなら無断素材なしで目に止められるため。",
      instruction: quoteXUrl
        ? "カードを生成して添付します。引用候補URLは必要時の代替素材として扱い、元投稿本文は再掲しません。"
        : "カードを生成して添付するか、カードなしのtext onlyで反応を測ります。",
      ogpCheckRequired: false,
      quoteXUrl: "",
    };
  }
  if (postType === "comparison_review" || postType === "profile_cta") {
    const story = dataStoryScore(product);
    if (story.score < 60) {
      return {
        strategy: "text_only",
        reason: `CARD NOT RECOMMENDED: Data Story Score ${story.score}/100。比較カードにするだけの明確な差が不足しています。`,
        instruction: "カードを生成せず、発掘アカウントとしての判断基準を本文で出します。",
        ogpCheckRequired: false,
        quoteXUrl: "",
      };
    }
    return {
      strategy: "comparison_card",
      reason: quoteXUrl
        ? "プロフィール誘導は引用だけに頼らず、向いている人の違いをテキストカードで見せる方がフォロー理由になるため。"
        : "比較・失敗回避のフォロー理由を、テキスト情報だけで見せられるため。",
      instruction: "カードを生成して添付します。価格、条件、見る前チェックだけを使い、作品画像/動画は取り込みません。",
      ogpCheckRequired: false,
      quoteXUrl: "",
    };
  }
  return {
    strategy: "text_only",
    reason: "引用元、正規OGP、許諾素材、カード向きデータが不足しているため安全側へ倒します。",
    instruction: "画像/動画は添付せず本文だけで投稿します。",
    ogpCheckRequired: false,
    quoteXUrl: "",
  };
}

function mediaPlanFor(product: MyfansProduct, postType: string, linkStrategy: MyfansLinkStrategy) {
  const creative = decideCreativeStrategy(product, postType, linkStrategy);
  if (creative.strategy === "quote_post") {
    return {
      label: "creator X投稿の引用",
      asset: "引用",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  if (creative.strategy === "myfans_ogp") {
    return {
      label: "myfans正規OGP",
      asset: "mfco.link OGP",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  if (creative.strategy === "permitted_media") {
    return {
      label: "許諾済み画像/動画",
      asset: "許諾済み素材",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  if (creative.strategy === "ranking_card" || creative.strategy === "comparison_card" || creative.strategy === "discovery_card") {
    return {
      label: creative.strategy === "ranking_card" ? "自作ランキングカード" : creative.strategy === "comparison_card" ? "自作比較カード" : "自作発見カード",
      asset: "テキスト画像",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  return {
    label: "画像/動画は任意",
    asset: "なし、または承認済み素材",
    instruction: "素材許可がある時だけ添付。ない時は本文のフックと条件で反応を見る。",
    reason: "フォロワー0期は無理に素材を使うより、型ごとの反応差を安全に測るため。",
  };
}

function cardPayloadFor(product: MyfansProduct, postType: string, strategy: MyfansCreativeStrategy) {
  const creatorName = product.myfans_creators?.display_name ?? "";
  const angle = inferAngle(product);
  const audience = inferAudience(product);
  const signals = productSignalList(product);
  const price = product.price > 0 ? `¥${product.price.toLocaleString("ja-JP")}` : "";
  const rank = product.popularity_rank ? `人気 ${product.popularity_rank}位` : "";
  const cardKind = strategy === "ranking_card" ? "ranking" : strategy === "comparison_card" ? "comparison" : "discovery";
  const headline = strategy === "ranking_card"
    ? (rank || price || "数字で見る1本")
    : strategy === "comparison_card"
      ? "向いてる人が分かれる1本"
      : "見るポイントは1つ";
  const primary = strategy === "ranking_card"
    ? `${angleAppeal(product)}か、数字と並べて見る`
    : strategy === "comparison_card"
      ? `${audience} / 合わない人はここで切れる`
      : `${angleAppeal(product)}か`;
  return {
    kind: strategy,
    title: shortTitle(product.title),
    creator: creatorName,
    cardKind,
    headline,
    primary,
    subtitle: strategy === "ranking_card" ? "数字で先に見る" : strategy === "comparison_card" ? "見る前チェック" : "好みで止まる発見",
    price,
    reward: "",
    rank,
    likes: product.likes_count > 0 ? `いいね ${product.likes_count.toLocaleString("ja-JP")}` : "",
    saves: product.saves_count > 0 ? `保存 ${product.saves_count.toLocaleString("ja-JP")}` : "",
    chip1: signals[0] ?? "",
    chip2: signals[1] ?? "",
    chip3: signals[2] ?? "",
    angle,
    audience,
    audienceLine: `向いてる人: ${audience}`,
    check: postType === "ranking_note"
      ? "数字は入口。保存理由まで見る"
      : postType === "comparison_review" || postType === "profile_cta"
        ? "合う人/合わない人を先に分ける"
        : "好みの軸を先に見る",
    footer: "@lumi_reviw / myfans発掘・比較",
  };
}

function publicCopyFactsFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null): PublicCopyFacts {
  return {
    sourceText: (quote?.text_excerpt ?? "").trim(),
    creatorName: product.myfans_creators?.display_name ?? "",
    creatorHandle: quote?.source_x_handle ? `@${quote.source_x_handle.replace(/^@/, "")}` : "",
    publicMetrics: {
      views: quote?.views ?? null,
      likes: quote?.likes ?? null,
      reposts: quote?.reposts ?? null,
      replies: quote?.replies ?? null,
      popularityRank: product.popularity_rank,
      productLikes: product.likes_count,
      productSaves: product.saves_count,
      price: product.price,
      isNew: product.is_new,
    },
    visualContext: hasBrowserVisibleVisual(quote)
      ? quote?.media_type === "video" ? "video" : "image"
      : quote ? "public_post" : "text_only",
    quoteVisualAnalysis: visualAnalysisForQuote(quote),
    productFacts: {
      title: product.title,
      genre: product.genre,
    },
  };
}

export function publicCopyInputHash(facts: PublicCopyFacts) {
  return `v11-${stableHash(JSON.stringify(facts))}`;
}

function bodyFor(product: MyfansProduct, postType: string, linkStrategy: MyfansLinkStrategy, creativeStrategy: MyfansCreativeStrategy, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null, variant = 0) {
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

function socialProofLine(facts: PublicCopyFacts) {
  const views = facts.publicMetrics.views;
  if (views && views >= 100_000) return `そりゃ${Math.floor(views / 10_000)}万表示いくよな、ってなる。`;
  if (views && views >= 50_000) return "ここまで伸びるのも分かる。";
  if ((facts.publicMetrics.likes ?? 0) >= 1000) return "いいねが集まるのも納得。";
  return "";
}

function humanReactionLine(reactionType: HumanReactionType, understanding: VisualUnderstanding, variant = 0) {
  const medium = understanding.mediaType === "video" ? "これ" : understanding.mediaType === "image" ? "この1枚" : "この投稿";
  const cue = understanding.concreteVisualCue && !weakAttentionCue(understanding.concreteVisualCue)
    ? understanding.concreteVisualCue
    : understanding.attentionMoment || understanding.humanObservation;
  if (cue) {
    const concreteByType: Record<HumanReactionType, string[]> = {
      surprise: [`${cue}、最初の引きが強い。`, `${cue}って分かった瞬間ちょっと止まる。`, `${cue}だけで一回目が行く。`],
      agreement: [`${cue}なら、そりゃ見ちゃう。`, `${cue}が先に来ると伸びるの分かる。`, `${cue}で入れるのは強い。`],
      curiosity: [`${cue}から入ると続きが気になる。`, `${cue}のあとを見たくなるやつ。`, `${cue}で止めてくるのずるい。`],
      contrast: [`${cue}で先に印象が変わる。`, `${cue}があるから普通に流せない。`, `${cue}のギャップで目が戻る。`],
      immediacy: [`${cue}を冒頭に置くの強い。`, `${cue}で一瞬持っていく。`, `${cue}だけで空気が伝わる。`],
      specific_appeal: [`${cue}が好きな人には一瞬で刺さる。`, `${cue}の方向性がはっきりしてる。`, `${cue}で好みが分かれる。`],
      unexpected: [`${cue}、思ったより引きがある。`, `${cue}が先に来るのちょっとずるい。`, `${cue}で予想より気になる。`],
      visual_clarity: [`${cue}だけで何系か分かる。`, `${cue}が先に見えるの分かりやすい。`, `${cue}で雰囲気まで入ってくる。`],
    };
    return concreteByType[reactionType][variant % concreteByType[reactionType].length];
  }
  const byType: Record<HumanReactionType, string[]> = {
    surprise: [`え、${medium}は強い。`, `これ流れてきたら一回止まる。`, `最初に見た瞬間でちょっと持っていかれる。`],
    agreement: [`そりゃ伸びるよな、ってなる。`, `${medium}、反応集まるの分かる。`, `見たら伸びてる理由はすぐ分かる。`],
    curiosity: [`この続き、普通に気になる。`, `ここからどうなるのか見たくなるやつ。`, `一回開いて確かめたくなる。`],
    contrast: [`最初はさらっと見えるのに、途中で印象変わりそう。`, `ぱっと見より後から効いてくるタイプ。`, `普通に流せそうで、結局戻りたくなる。`],
    immediacy: [`最初の数秒で持っていくの強い。`, `説明される前に雰囲気が伝わる。`, `一瞬で何が強いか分かるのずるい。`],
    specific_appeal: [`この近さが刺さる人は一瞬で分かる。`, `作り込みすぎてない感じが逆に残る。`, `見た瞬間に好みが分かれるの強い。`],
    unexpected: [`思ってたより引きが強い。`, `軽く見るつもりでも、これは残る。`, `予想よりちゃんと気になってしまう。`],
    visual_clarity: [`画像だけで伝わるの強い。`, `${medium}だけで空気が分かる。`, `言葉で盛らなくても伝わるタイプ。`],
  };
  return byType[reactionType][variant % byType[reactionType].length];
}

function whyAngleLine(reactionType: HumanReactionType, understanding: VisualUnderstanding, facts: PublicCopyFacts, variant = 0) {
  const proof = socialProofLine(facts);
  const cue = understanding.concreteVisualCue && !weakAttentionCue(understanding.concreteVisualCue)
    ? understanding.concreteVisualCue
    : understanding.attentionMoment || understanding.humanObservation;
  if (cue) {
    if (reactionType === "curiosity") return "ここからどう見せるのか普通に気になる。";
    if (reactionType === "agreement") return `${cue}で先に引けてる。`;
    if (reactionType === "contrast") return understanding.visibleChangeOrContrast || "そのズレで見返したくなる。";
    if (reactionType === "specific_appeal") return "合う人にはかなり早い段階で伝わる。";
    if (reactionType === "visual_clarity") return "説明より先に好みが判断できる。";
    if (reactionType === "immediacy") return understanding.mediaType === "video" ? "冒頭で置かれると先を見たくなる。" : "1枚目で置かれると流せない。";
    if (proof && variant % 4 === 0) return proof;
    return "だから反応が集まるのも分かる。";
  }
  if (reactionType === "curiosity") return understanding.mediaType === "video" ? "冒頭だけで先を見たくなる。" : "この切り取りだけで先が気になる。";
  if (reactionType === "agreement") return "見せ方が分かりやすいから、知らなくても入りやすい。";
  if (reactionType === "contrast") return understanding.motionCue || "ぱっと見と残り方に差がある。";
  if (reactionType === "specific_appeal") return "刺さるポイントが一瞬で伝わる。";
  if (reactionType === "visual_clarity") return "説明より先に雰囲気が入ってくる。";
  if (reactionType === "immediacy") return "冒頭だけで続きを見たくなる。";
  if (proof && variant % 4 === 0) return proof;
  return "こういう分かりやすい引きは強い。";
}

function humanObservationVariants(understanding: VisualUnderstanding, facts: PublicCopyFacts, variant = 0) {
  const translated = understanding.attentionMoment || understanding.humanObservation || humanObservationFromEvidence(facts.quoteVisualAnalysis, facts.visualContext, variant);
  if (!translated || understanding.visualAnalysisStatus !== "verified" || weakAttentionCue(translated)) return [];
  const momentFamilies: Array<[RegExp, string[][]]> = [
    [/制服っぽい写真から入る/, [
      ["制服っぽい写真から始まると、そこで一気に雰囲気が決まる。", "ただの紹介より、先に人の感じが出るのがいい。"],
      ["階段の写真で制服っぽさが先に来るの、普通に引きがある。", "プロフィール画面より、その前の一枚のほうが気になる。"],
    ]],
    [/海辺で赤と黒だけぱっと浮く/, [
      ["海辺で赤と黒だけぱっと浮くの、見た瞬間に強い。", "明るい場所なのに色が残るから、流しにくい。"],
      ["砂浜の明るさに赤と黒がはっきり出てる。", "これだけ伸びてるのも少し分かる。"],
    ]],
    [/ベッド越しの距離が近い/, [
      ["ベッド越しの距離が近いと、それだけで場面が伝わる。", "盛って言わなくても、好きな人にはそこで刺さる。"],
      ["白いベッドより、向かい合ってる近さのほうが先に来る。", "この距離感は説明される前に分かる。"],
    ]],
    [/白いベッドに青いランジェリーが出る/, [
      ["白いベッドに青が入るだけで、ぱっと見の印象がかなり変わる。", "色が先に残るから、細かい説明はいらない。"],
      ["ベッドの白さに青いランジェリーが乗ると、そこだけ先に見える。", "これは好きな人なら一瞬で分かる。"],
    ]],
    [/くまっぽい小物と踊り出しのゆるさ/, [
      ["くまっぽい小物と踊り出しのゆるさ、最初から少し気になる。", "作り込みすぎてない感じが逆に残る。"],
      ["踊り出しが軽いのに、小物で妙に印象が残る。", "こういうゆるい入り方は最後まで見てしまう。"],
    ]],
    [/引きから近めに変わる/, [
      ["引きで見せてから近めに変わるの、そこで見方が変わる。", "最初だけで判断しにくいから、少し先まで見たくなる。"],
      ["最初は引きなのに、途中で距離が詰まる。", "この変わり方は流してると戻りたくなる。"],
    ]],
  ];
  const matched = momentFamilies.find(([pattern]) => pattern.test(translated))?.[1];
  if (matched) return matched;
  const copyFamilies = [
    [
      `${translated}。`,
      "こういう入り方だと、説明が少なくても手が止まる。",
    ],
    [
      `${translated}のがいい。`,
      facts.visualContext === "video" ? "動きの前置きが短いから、そのまま見てしまう。" : "色と距離で先に引っかかるから、文字を読む前に止まる。",
    ],
    [
      `${translated}。`,
      "盛って言わなくても、好きな人にはそこで刺さる。",
    ],
    [
      `${translated}、地味に強い。`,
      facts.visualContext === "video" ? "最初から全部説明しない感じが逆に気になる。" : "ぱっと見で場面が伝わる一枚は流しにくい。",
    ],
  ];
  return copyFamilies.map((lines) => {
    const adjusted = facts.publicMetrics.views && facts.publicMetrics.views >= 100_000 && variant % 5 === 0
      ? [lines[0], "これだけ伸びてるのも少し分かる。"]
      : lines;
    return adjusted;
  });
}

function buildPublicCopyV8(facts: PublicCopyFacts, postType: string, linkStrategy: MyfansLinkStrategy, variant = 0) {
  const understanding = visualUnderstandingFor(facts);
  const reactionType = reactionTypeFor(facts, variant);
  const first = humanReactionLine(reactionType, understanding, variant);
  const second = whyAngleLine(reactionType, understanding, facts, variant);
  const isRevenue = postType === "reply_link_sales" || postType === "body_link_sales";
  const lines = isRevenue
    ? [`${first}${postType === "body_link_sales" ? " #PR" : ""}`, postType === "body_link_sales" ? "気になる人だけ詳細へ。" : "気になる人だけ自己リプへ。"]
    : [first, second];
  if (linkStrategy === "profile_cta" && second === socialProofLine(facts)) return [first, "好みならプロフィールまで見たくなる。"];
  return lines;
}

function buildPublicCopyV9(facts: PublicCopyFacts, postType: string, linkStrategy: MyfansLinkStrategy, variant = 0) {
  const understanding = visualUnderstandingFor(facts);
  const cue = understanding.concreteVisualCue;
  if (!cue || understanding.visualAnalysisStatus !== "verified") return buildPublicCopyV8(facts, postType, linkStrategy, variant);
  const context = understanding.visibleChangeOrContrast || understanding.cameraDistanceOrFraming || understanding.compositionOrStyle || understanding.textOverlayCue || understanding.motionCue;
  const firstOptions = [
    `${cue}から入るの強い。`,
    `${cue}で一回止まる。`,
    `${cue}だけで空気がだいぶ伝わる。`,
  ];
  const secondOptions = [
    context ? `${context}から続きが気になる。` : "最後まで見たくなる始まり方。",
    "これは続きまで確認したくなる。",
    context ? `${context}から先を見たくなる。` : "見た人の手が止まるの分かる。",
  ];
  const isRevenue = postType === "reply_link_sales" || postType === "body_link_sales";
  const first = firstOptions[variant % firstOptions.length];
  const second = isRevenue
    ? (postType === "body_link_sales" ? "気になる人だけ詳細へ。" : "気になる人だけ自己リプへ。")
    : secondOptions[variant % secondOptions.length];
  return [`${first}${postType === "body_link_sales" ? " #PR" : ""}`, second];
}

function buildPublicCopyV10(facts: PublicCopyFacts, postType: string, linkStrategy: MyfansLinkStrategy, variant = 0) {
  const understanding = visualUnderstandingFor(facts);
  if (understanding.visualAnalysisStatus !== "verified" || !understanding.attentionMoment || understanding.attentionValue.score < MYFANS_ATTENTION_VALUE_MINIMUM) return buildPublicCopyV8(facts, postType, linkStrategy, variant);
  const isRevenue = postType === "reply_link_sales" || postType === "body_link_sales";
  const variants = humanObservationVariants(understanding, facts, variant);
  const selectedIndex = (variant + stableHash(understanding.rawVisualEvidence || understanding.humanObservation)) % Math.max(1, variants.length);
  const selected = variants[selectedIndex] ?? buildPublicCopyV9(facts, postType, linkStrategy, variant);
  if (!isRevenue) return selected;
  return [`${selected[0]}${postType === "body_link_sales" ? " #PR" : ""}`, postType === "body_link_sales" ? "気になる人だけ詳細へ。" : "気になる人だけ自己リプへ。"];
}

function replyFor(product: MyfansProduct, linkStrategy: MyfansLinkStrategy) {
  if (linkStrategy !== "reply_link" || !isValidRevenueProduct(product)) return "";
  return `#PR\n詳細はこちら\n${product.affiliate_url}`.trim();
}

function fitXBody(lines: string[], maxWeight: number) {
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

function isValidMfcoLink(value: string) {
  return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+(?:[/?#].*)?$/.test(value.trim());
}

function isValidRevenueProduct(product: MyfansProduct) {
  return isValidMfcoLink(product.affiliate_url) && (product.reward_rate > 0 || product.estimated_reward > 0 || product.plan_signup_reward > 0);
}

type BuildMyfansExecutionBoardOptions = {
  planDate?: string;
  operationDay?: number;
  generationVersion?: string;
};

export function buildMyfansExecutionBoard(analytics: MyfansAnalytics, options: BuildMyfansExecutionBoardOptions = {}) {
  const day = options.operationDay ?? getOperationDay();
  const planDate = options.planDate ?? currentPlanDate();
  const stage = getGrowthStage(day);
  const generationVersion = options.generationVersion ?? MYFANS_PUBLIC_COPY_GENERATOR_VERSION;
  const planKey = `${analytics.selectedMediaId ?? "all"}:${planDate}:day-${day}:${stage}:${generationVersion}`;
  const learning = buildMyfansLearning(analytics);
  const rotation = adjustRotationByLearning(ROTATION[stage], stage, learning);
  const quotePool = buildMyfansQuotePool(analytics);
  const growthQuotePool = quotePool.global
    .filter((row) => hasBrowserVisibleVisual(row.candidate))
    .sort((a, b) =>
      Number(hasVerifiedVisualAnalysis(b.candidate)) - Number(hasVerifiedVisualAnalysis(a.candidate)) ||
      b.globalScore - a.globalScore ||
      (b.candidate.views ?? 0) - (a.candidate.views ?? 0)
    );
  const topicBaselines = buildTopicBaselines(analytics);
  const quoteBySlot = new Map<string, MyfansQuoteCandidate>();
  if (stage === "day_1_7") {
    const first = quotePool.selected[0]?.candidate;
    const second = quotePool.selected[1]?.candidate;
    if (first) quoteBySlot.set("discovery_interest:0", first);
    if (second) quoteBySlot.set("profile_cta:2", second);
  }
  const productStats = summarizeProductStats(analytics);
  const creatorProductCounts = new Map<number, number>();
  for (const product of analytics.products) {
    if (product.creator_id) creatorProductCounts.set(product.creator_id, (creatorProductCounts.get(product.creator_id) ?? 0) + 1);
  }
  const products = analytics.products
    .filter((product) => product.status !== "paused" && product.status !== "rejected")
    .map((product) => {
      const stats = productStats.get(product.id);
      const scores = calculateMyfansOpportunityScores({
        price: product.price,
        rewardRate: product.reward_rate,
        planSignupReward: product.plan_signup_reward,
        recurringRewardRate: product.recurring_reward_rate,
        popularityRank: product.popularity_rank,
        likesCount: product.likes_count,
        savesCount: product.saves_count,
        isNew: product.is_new,
        hasAffiliateUrl: Boolean(product.affiliate_url),
        hasApprovedMedia: Boolean(product.approved_media_name || product.affiliate_media_id),
        source_x_url: product.source_x_url,
        createdAt: product.created_at,
        creatorProductCount: product.creator_id ? creatorProductCounts.get(product.creator_id) : 1,
        pastImpressions: stats?.impressions,
        pastClicks: stats?.clicks,
        pastConversions: stats?.conversions,
        pastReward: stats?.reward,
        observedUpdateCount30d: analytics.products.filter((item) => item.creator_id && item.creator_id === product.creator_id && inPeriod(item.created_at, 30)).length,
        planSignupEvidenceCount: analytics.conversions.filter((item) => item.product_id === product.id && item.conversion_type.includes("plan")).length || undefined,
      });
      const recentProductPenalty = recentUsedProductIds(analytics, 3).has(product.id) ? 35 : 0;
      const recentCreatorPenalty = recentUsedCreatorKeys(analytics).has(creatorKeyFromProduct(product)) ? 20 : 0;
      const dailyFreshnessJitter = stableHash(`${planKey}:${product.id}`) % 17;
      return {
        product,
        scores,
        plannerScore: scores.growthScore + scores.revenueScore + scores.creatorLtvScore + dailyFreshnessJitter - recentProductPenalty - recentCreatorPenalty,
      };
    })
    .sort((a, b) => b.plannerScore - a.plannerScore)
    .slice(0, 100);
  const productForQuote = (quote: MyfansQuoteCandidate | null) => {
    if (!quote) return null;
    if (quote.product_id) {
      const direct = products.find((row) => row.product.id === quote.product_id);
      if (direct) return direct;
    }
    const quoteCreatorKey = creatorKeyFromQuote(quote);
    return products.find((row) => creatorKeyFromProduct(row.product) === quoteCreatorKey) ?? null;
  };
  const topicQuoteFor = (row: (typeof products)[number]) => {
    const direct = analytics.quoteCandidates.find((candidate) => candidate.product_id === row.product.id && (hasVerifiedVisualAnalysis(candidate) || (candidate.views ?? 0) >= 50_000));
    if (direct) return direct;
    const creatorKey = creatorKeyFromProduct(row.product);
    const sameCreator = analytics.quoteCandidates.find((candidate) => (hasVerifiedVisualAnalysis(candidate) || (candidate.views ?? 0) >= 50_000) && creatorKeyFromQuote(candidate) === creatorKey);
    if (sameCreator) return sameCreator;
    return null;
  };
  const topicRows = products.flatMap((row) => {
    const quote = topicQuoteFor(row);
    const roles: DailyRole[] = isValidRevenueProduct(row.product)
      ? ["REVENUE", "DISCOVERY", "AUTHORITY", "ATTENTION"]
      : ["DISCOVERY", "AUTHORITY", "ATTENTION"];
    return roles.map((role) => {
      const topicValue = evaluateMyfansTopicValue({ product: row.product, quote, role, baselines: topicBaselines });
      return {
        productId: row.product.id,
        title: row.product.title,
        role,
        creatorKey: creatorKeyFromProduct(row.product),
        quoteCandidateId: quote?.id ?? null,
        sourceCandidate: quote ? quoteUrlFromCandidate(quote) : row.product.source_x_url || row.product.product_url,
        topicIdentity: topicIdentityFor(row.product, quote, topicValue.reasonToCare),
        topicSemanticKey: topicSemanticKeyFor(row.product, quote, topicValue),
        topicValue,
      };
    });
  }).sort((a, b) => b.topicValue.score - a.topicValue.score);
  const candidateFunnel = {
    dbTotal: analytics.products.length,
    basicEligible: products.length,
    visualQuality: quotePool.funnel.qualified,
    topicValuePass: topicRows.filter((row) => row.topicValue.verdict === "PASS").length,
    shortlist: topicRows.filter((row) => row.topicValue.verdict === "PASS").slice(0, 10).length,
    final: 0,
  };
  const topicPassRows = topicRows.filter((row) => row.topicValue.verdict === "PASS");
  const allowSameProductAcrossDistinctRoles = false;
  const topicPassProductIds = topicPassRows.map((row) => row.productId);

  const usedProductIds = new Set<number>();
  const pickProduct = (needsAffiliateUrl: boolean, index: number, postType: string, exclude = usedProductIds) => {
    const pool = needsAffiliateUrl ? products.filter((row) => isValidRevenueProduct(row.product)) : products;
    const role = postType === "reply_link_sales" || postType === "body_link_sales" ? "REVENUE" : roleFor(postType, "no_link", "text_only");
    const topicReady = (row: (typeof products)[number]) => {
      const quote = topicQuoteFor(row);
      return evaluateMyfansTopicValue({ product: row.product, quote, role, baselines: topicBaselines }).verdict === "PASS";
    };
    if (postType === "ranking_note") {
      const discoveryReady = pool.find((row) => topicPassProductIds.includes(row.product.id) && !exclude.has(row.product.id) && topicReady(row))
        ?? pool.find((row) => !exclude.has(row.product.id) && topicReady(row));
      if (discoveryReady) return discoveryReady;
    }
    if (postType === "profile_cta" || postType === "comparison_review") {
      const authorityReady = pool.find((row) => !exclude.has(row.product.id) && topicReady(row));
      if (authorityReady) return authorityReady;
    }
    const shouldUseQuoteCandidate = postType === "discovery_interest" || postType === "profile_cta";
    const unusedQuote = shouldUseQuoteCandidate
      ? pool.find((row) => row.product.quote_candidate_x_url && !exclude.has(row.product.id))
      : null;
    const unusedTopicProduct = pool.find((row) => topicPassProductIds.includes(row.product.id) && !exclude.has(row.product.id));
    const unused = unusedQuote ?? unusedTopicProduct ?? pool.find((row) => !exclude.has(row.product.id));
    const scored = unused ?? pool[index] ?? pool[0] ?? products.find((row) => !exclude.has(row.product.id)) ?? products[index] ?? products[0] ?? null;
    return scored;
  };

  const acceptedBodies: string[] = [];
  const acceptedQuoteCreators = new Set<string>();
  const acceptedReactionTypes = new Set<HumanReactionType>();
  const acceptedTopicIdentities = new Set<string>();
  const acceptedTopicSemanticKeys: string[] = [];
  const acceptedReasonCounts = new Map<MyfansReasonToCare, number>();
  const acceptedCreatorCounts = new Map<string, number>();
  const recoveryHistory: Array<{
    slot: string;
    attempt: number;
    candidateId: string;
    productId: number | null;
    quoteCandidateId: number | null;
    initialRole: DailyRole;
    recoveryRole: DailyRole;
    role: string;
    hook: string;
    creative: string;
    score: number;
    verdict: string;
    holdReason: string;
    copyAngle: CopySearchAngle;
    reasonToCare: MyfansReasonToCare | null;
    topicIdentity: string;
    topicSemanticKey: string;
    qualityReasons: string[];
    recoveryAction: string;
  }> = [];
  const initialAttempts: Array<{ slot: string; postType: string; score: number; verdict: string; holdReason: string }> = [];

  const fallbackPostTypes = (postType: string) => {
    if (postType === "profile_cta") return ["profile_cta", "ranking_note", "comparison_review", "discovery_interest"];
    if (postType === "ranking_note") return ["ranking_note", "profile_cta", "comparison_review", "discovery_interest"];
    if (postType === "discovery_interest") return ["discovery_interest", "ranking_note", "profile_cta", "comparison_review"];
    if (postType === "reply_link_sales" || postType === "body_link_sales") return [postType, "profile_cta", "ranking_note", "comparison_review", "discovery_interest"];
    return [postType, "ranking_note", "profile_cta", "comparison_review", "discovery_interest"];
  };

  const classifyHoldReason = (quality: ReturnType<typeof qualityScoreFor>) => {
    if (quality.reasons.some((reason) => /LOW_TOPIC_VALUE/.test(reason))) return "LOW_TOPIC_VALUE";
    if (quality.reasons.some((reason) => /concrete visual|具体visual|抽象リアクション/.test(reason))) return "visual cue不足";
    if (quality.reasons.some((reason) => /First-line|curiosity|85未満/.test(reason)) && quality.breakdown.firstLineStop < 25) return "hook弱い";
    if (!quality.reasons.some((reason) => /DISCOVERY|AUTHORITY|REVENUE/.test(reason)) && quality.breakdown.specificity < 20) return "specificity弱い";
    if (quality.breakdown.visual < 12) return "visual弱い";
    if (quality.breakdown.audience < 15) return "audience不明";
    if (quality.reasons.some((reason) => /同じ|テンプレ|語尾|構文/.test(reason))) return "sameness高い";
    if (quality.verdict === "HOLD" && quality.reasons.some((reason) => /公開可能/.test(reason))) return "sameness高い";
    if (quality.reasons.some((reason) => /discovery差なし/.test(reason))) return "discovery差なし";
    if (quality.reasons.some((reason) => /Revenue|mfco/.test(reason))) return "profile CTA弱い";
    return quality.reasons[0] ?? "Quality Gate未達";
  };

  const recoveryActionFor = (reason: string, postType: string, nextPostType: string, nextAttempt: number) => {
    if (reason === "LOW_TOPIC_VALUE") return postType !== nextPostType ? "LOW_TOPIC_VALUE → 別role/別candidateへ移動" : "LOW_TOPIC_VALUE → 文面retryせず別candidateへ移動";
    if (reason === "visual cue不足") return "boring cueを救済せず、別verified cue/quote/creatorへ移動";
    if (reason === "hook弱い") return "1行目だけでなくangleごと変更して再生成";
    if (reason === "specificity弱い") return "別候補/別データ差へ切替";
    if (reason === "visual弱い") return "別quote/画像へ切替";
    if (reason === "sameness高い") return "別構文/別roleへ切替";
    if (reason === "audience不明") return "audienceを内部再設定してpublic copy再生成";
    if (reason === "discovery差なし") return "DISCOVERY差なし → AUTHORITYへrole swap";
    if (postType !== nextPostType) return `${postType} → ${nextPostType}へrole swap`;
    return `候補${nextAttempt + 1}へ再探索`;
  };

  const quoteForAttempt = (product: MyfansProduct | null, postType: string, index: number, attempt: number) => {
    if (!product || !["discovery_interest", "ranking_note", "profile_cta", "comparison_review"].includes(postType)) return null;
    const productCreatorKey = creatorKeyFromProduct(product);
    const matchesProduct = (candidate: MyfansQuoteCandidate) => candidate.product_id === product.id || creatorKeyFromQuote(candidate) === productCreatorKey;
    const direct = attempt === 0 ? quoteBySlot.get(`${postType}:${index}`) : null;
    if (direct && (matchesProduct(direct) || postType === "discovery_interest")) return direct;
    const directProductQuote = attempt <= 1 ? analytics.quoteCandidates
      .filter((candidate) => candidate.product_id === product.id && !candidate.last_used_at && (hasBrowserVisibleVisual(candidate) || (candidate.views ?? 0) >= 50_000))
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || b.score - a.score)[0] ?? null : null;
    if (directProductQuote) return directProductQuote;
    const productQuote = attempt <= 1 ? quotePool.global.find((row) => row.candidate.product_id === product.id && !row.candidate.last_used_at && hasBrowserVisibleVisual(row.candidate) && !acceptedQuoteCreators.has(creatorKeyFromQuote(row.candidate)))?.candidate : null;
    if (productQuote) return productQuote;
    const available = quotePool.global.filter((row) => matchesProduct(row.candidate) && !row.candidate.last_used_at && hasBrowserVisibleVisual(row.candidate) && !acceptedQuoteCreators.has(creatorKeyFromQuote(row.candidate)));
    if (available.length) return available[(attempt + index) % available.length]?.candidate ?? null;
    const verifiedBackup = analytics.quoteCandidates
      .filter((candidate) => matchesProduct(candidate) && !candidate.last_used_at && hasBrowserVisibleVisual(candidate) && !acceptedQuoteCreators.has(creatorKeyFromQuote(candidate)))
      .sort((a, b) => b.score - a.score || visualPriority(b) - visualPriority(a));
    return verifiedBackup[(attempt + index) % Math.max(1, verifiedBackup.length)] ?? null;
  };

  const buildCandidate = (item: RotationItem, index: number, attempt: number, excludedProducts: Set<number>) => {
    const requestedPostType = fallbackPostTypes(item.postType)[attempt % fallbackPostTypes(item.postType).length];
    const requestedRole: DailyRole = requestedPostType === "reply_link_sales" || requestedPostType === "body_link_sales"
      ? "REVENUE"
      : roleFor(requestedPostType, "no_link", "text_only");
    const requestedLinkStrategy: MyfansLinkStrategy = requestedRole === "REVENUE"
      ? item.linkStrategy
      : requestedRole === "AUTHORITY"
        ? "profile_cta"
        : "no_link";
    const needsAffiliateUrl = requestedLinkStrategy === "body_link" || requestedLinkStrategy === "reply_link";
    const directGrowthQuote = !needsAffiliateUrl && requestedPostType === "discovery_interest"
      ? quoteBySlot.get(`${requestedPostType}:${index}`) ?? growthQuotePool[(index + attempt) % Math.max(1, growthQuotePool.length)]?.candidate ?? null
      : null;
    const scored = directGrowthQuote
      ? productForQuote(directGrowthQuote) ?? pickProduct(needsAffiliateUrl, index + attempt, requestedPostType, excludedProducts)
      : pickProduct(needsAffiliateUrl, index + attempt, requestedPostType, excludedProducts);
    const product = scored?.product ?? null;
    const hasAffiliateUrl = Boolean(product && isValidRevenueProduct(product));
    const linkStrategy = needsAffiliateUrl && !hasAffiliateUrl
      ? "no_link"
      : requestedLinkStrategy;
    const objective = needsAffiliateUrl && !hasAffiliateUrl
      ? "impression"
      : item.objective;
    const postType = needsAffiliateUrl && !hasAffiliateUrl
      ? "discovery_interest"
      : requestedPostType;
    const cta = needsAffiliateUrl && !hasAffiliateUrl
      ? "保存用の発見メモ"
      : item.cta;
    const role = needsAffiliateUrl && !hasAffiliateUrl
      ? `${item.role} / 正規アフィURL未取得のためリンクなし運用`
      : requestedPostType !== item.postType ? `${item.role} / ${item.postType}から${requestedPostType}へRecovery` : item.role;
    const creativeVariantId = `${analytics.selectedMediaId ?? "all"}-${planDate}-day-${day}-${stage}-${MYFANS_PUBLIC_COPY_GENERATOR_VERSION}-${postType}-${linkStrategy}-${index + 1}-try-${attempt + 1}`;
    const angleVariant = angleVariantSeed(index, attempt);
    const quoteForSlot = directGrowthQuote && postType === "discovery_interest"
      ? directGrowthQuote
      : quoteForAttempt(product, postType, index, attempt);
    const quoteXUrl = quoteForSlot && postType === "discovery_interest" && hasVerifiedVisualAnalysis(quoteForSlot) ? quoteUrlFromCandidate(quoteForSlot) : "";
    const creative = product ? decideCreativeStrategy(product, postType, linkStrategy, quoteXUrl) : null;
    const evidenceQuote = creative?.strategy === "quote_post" ? quoteForSlot : (quoteForSlot ?? null);
    const dailyRole = roleFor(postType, linkStrategy, creative?.strategy ?? "text_only");
    const mediaPlan = product && creative ? mediaPlanFor(product, postType, linkStrategy) : null;
    const hook = product ? hookIntelligence(product, quoteForSlot ?? null) : null;
    const attention = product ? attentionScoreFor(product, quoteForSlot ?? null, analytics) : null;
    const publicCopyFacts = product ? publicCopyFactsFor(product, evidenceQuote) : null;
    const visualUnderstanding = publicCopyFacts ? visualUnderstandingFor(publicCopyFacts) : null;
    const reactionType = publicCopyFacts ? reactionTypeFor(publicCopyFacts, angleVariant) : null;
    const copyInputHash = publicCopyFacts ? publicCopyInputHash(publicCopyFacts) : "";
    const topicValue = product ? evaluateMyfansTopicValue({ product, quote: evidenceQuote, role: dailyRole, baselines: topicBaselines }) : null;
    const topicIdentity = product ? topicIdentityFor(product, evidenceQuote, topicValue?.reasonToCare) : "";
    const topicSemanticKey = product ? topicSemanticKeyFor(product, evidenceQuote, topicValue) : "";
    const copyAngle = copySearchAngleFor(topicValue?.reasonToCare, angleVariant);
    const topicCopyFitFailed = topicValue?.verdict === "PASS" && !roleFitsReasonToCare(dailyRole, topicValue.reasonToCare);
    const body = product && topicValue?.verdict === "PASS" && !topicCopyFitFailed ? bodyFor(product, postType, linkStrategy, creative?.strategy ?? "text_only", evidenceQuote, topicValue, angleVariant) : "";
    const lowTopicQuality = topicValue?.verdict === "LOW_TOPIC_VALUE"
      ? {
        total: Math.min(74, topicValue.score),
        verdict: "HOLD",
        breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: topicValue.breakdown.visualStoryValue, specificity: topicValue.breakdown.concreteDifference, proof: topicValue.breakdown.socialProofMomentum, broadCuriosity: topicValue.breakdown.humanCuriosity, audience: 0, followReason: 0, attentionValue: attention?.score ?? 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 },
        reasons: [`LOW_TOPIC_VALUE: ${topicValue.whyRejected.join(" / ")}`],
      }
      : null;
    const fitQuality = topicCopyFitFailed
      ? {
        total: Math.min(84, topicValue?.score ?? 0),
        verdict: "HOLD",
        breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: 0, specificity: 0, proof: 0, broadCuriosity: 0, audience: 0, followReason: 0, attentionValue: attention?.score ?? 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 },
        reasons: [`Topic-to-Copy Fit不一致: ${topicValue?.reasonToCare ?? "unknown"}は${dailyRole}向きではありません`],
      }
      : null;
    const quality = lowTopicQuality ?? fitQuality ?? (product && creative && hook && attention
      ? qualityScoreFor({ body, product, postType, linkStrategy, creativeStrategy: creative.strategy, quote: quoteForSlot ?? null, hook: hook.hook, attentionScore: attention.score, topicValue })
      : { total: 0, verdict: "HOLD", breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: 0, specificity: 0, proof: 0, broadCuriosity: 0, audience: 0, followReason: 0, attentionValue: 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 }, reasons: ["商品候補がありません"] });
    const topicThreshold = topicThresholdFor(dailyRole);
    return {
      id: creativeVariantId,
      product,
      body,
      publicCopyFacts,
      visualUnderstanding,
      reactionType,
      copyAngle,
      multiAngleAttempt: attempt % MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC + 1,
      reasonToCare: topicValue?.reasonToCare ?? null,
      whyThisAngle: visualUnderstanding && reactionType && publicCopyFacts ? whyAngleLine(reactionType, visualUnderstanding, publicCopyFacts, attempt + index) : "",
      generatorVersion: MYFANS_PUBLIC_COPY_GENERATOR_VERSION,
      copyInputHash,
      selfReply: product ? replyFor(product, linkStrategy) : "",
      affiliateUrl: product?.affiliate_url ?? "",
      sourceXUrl: product?.source_x_url ?? "",
      quoteXUrl: creative?.quoteXUrl ?? "",
      creativeStrategy: creative?.strategy ?? "text_only",
      dailyRole,
      creativeReason: creative?.reason ?? "",
      cardPayload: product ? cardPayloadFor(product, postType, creative?.strategy ?? "text_only") : {},
      ogpCheckRequired: creative?.ogpCheckRequired ?? false,
      mediaPermissionStatus: product?.media_permission_status ?? "unknown",
      approvedMediaName: product?.approved_media_name || "@lumi_reviw",
      approvedMediaId: product?.approved_media_id ?? analytics.selectedMediaId ?? null,
      growthStage: stage,
      postType,
      linkStrategy,
      ctaStrategy: cta,
      creativeVariantId,
      plannedSlot: item.slot,
      objective,
      role,
      reason: needsAffiliateUrl && !hasAffiliateUrl
        ? "正規アフィURLが未取得のため、通常商品URLを代替せずリンク投稿から外します。"
        : reasonFor(stage, linkStrategy, objective),
      planningReason: planningReasonFor(stage, learning),
      opportunity: scored?.scores ?? null,
      productReason: product
        ? `${product.selection_reason || scored?.scores.reason || reasonFor(stage, linkStrategy, objective)}${needsAffiliateUrl && !hasAffiliateUrl ? " 正規アフィURLなしのため収益投稿には使いません。" : ""}`
        : "",
      mediaPlan,
      mediaPolicy: quoteForSlot
        ? `${creative?.instruction ?? ""} media:${quoteForSlot.media_type ?? "none"} / visual:${visualRenderStatus(quoteForSlot)} / url:${quoteForSlot.quote_visual_ready && quoteForSlot.media_permalink ? "media_permalink" : "status"} / ${quoteInsight(quoteForSlot)} / ${quoteForSlot.score_reason}`
        : creative?.instruction ?? mediaPlan?.instruction ?? "",
      reader: product ? inferAudience(product) : "",
      audienceIntent: product ? audienceIntentFor(postType, product) : "broad_curiosity",
      hookType: hook?.hook ?? "COMPARISON",
      hookLabel: hook?.label ?? "根拠不足",
      hookEvidence: hook?.evidence ?? {},
      attention,
      quality,
      topicValue,
      topicIdentity,
      topicSemanticKey,
      topicThreshold,
      readerValue: product ? readerValueFor(postType, product) : "",
      stopReason: product ? stopReasonFor(postType, product) : "",
      ctaRole: dailyRole === "REVENUE"
        ? "本文では売り込まず、確認したい人だけ正規リンクへ進ませる。"
        : linkStrategy === "profile_cta"
        ? "投稿単体で判断軸を出した後、過去比較を見る人だけプロフィールへ送る。"
        : linkStrategy === "reply_link"
          ? "本文では売り込まず、確認したい人だけ自己リプへ進ませる。"
          : "反応確認が目的なので、問いや共感で保存・返信のきっかけを作る。",
      assetRole: mediaPlan?.reason ?? "",
    };
  };

  const publishableCandidates: Array<ReturnType<typeof buildCandidate>> = [];
  const heldCandidates = [];

  const evaluateDiversity = (candidate: ReturnType<typeof buildCandidate>) => {
    let quality = candidate.quality;
    const publicText = [candidate.body, candidate.selfReply].filter(Boolean).join("\n");
    const leak = detectPublicCopyLeak(publicText);
    if (leak.hasLeak) quality = holdQuality(quality, `Public Copy leak: ${leak.matches.join(" / ")}`);
    const diversityIssue = hasPublicCopyDiversityIssue(candidate.body, acceptedBodies);
    if (diversityIssue) quality = holdQuality(quality, diversityIssue);
    if (candidate.topicIdentity && acceptedTopicIdentities.has(candidate.topicIdentity)) quality = holdQuality(quality, `同じtopic_identityは日次planで1回までです: ${candidate.topicIdentity}`);
    const topicSimilarity = Math.max(0, ...acceptedTopicSemanticKeys.map((key) => semanticTopicSimilarity(candidate.topicSemanticKey, key)));
    if (topicSimilarity >= 0.75) quality = holdQuality(quality, `同じsource metric/eventに見えるためHOLDします: similarity ${topicSimilarity.toFixed(2)}`);
    const productScopedPost = candidate.dailyRole === "REVENUE" || candidate.creativeStrategy !== "quote_post";
    if (productScopedPost && candidate.product?.id && publishableCandidates.some((item) => item.product?.id === candidate.product?.id && (item.dailyRole === "REVENUE" || item.creativeStrategy !== "quote_post"))) {
      quality = holdQuality(quality, "同じproductは日次planで1回までです");
    }
    const creatorKeyForCandidate = candidate.product ? creatorKeyFromProduct(candidate.product) : "";
    if (creatorKeyForCandidate && (acceptedCreatorCounts.get(creatorKeyForCandidate) ?? 0) >= 2) quality = holdQuality(quality, "同じcreatorは日次planで最大2本までです");
    if (candidate.reasonToCare && (acceptedReasonCounts.get(candidate.reasonToCare) ?? 0) >= 2) quality = holdQuality(quality, `同じreason_to_care ${candidate.reasonToCare} は最大2本までです`);
    if (candidate.dailyRole === "AUTHORITY" && !candidate.topicIdentity.startsWith("aggregate:")) {
      quality = holdQuality(quality, "AUTHORITYは単一source/topicの言い換えでは採用しません");
    }
    if (candidate.creativeStrategy === "quote_post" && candidate.quoteXUrl && candidate.product) {
      const quote = analytics.quoteCandidates.find((item) => quoteUrlFromCandidate(item) === candidate.quoteXUrl || item.x_post_url === candidate.quoteXUrl);
      const creatorKey = quote ? creatorKeyFromQuote(quote) : creatorKeyFromProduct(candidate.product);
      if (acceptedQuoteCreators.has(creatorKey)) quality = holdQuality(quality, "同日の公開planでは同一creator quoteを1件までに制限しています");
      if (candidate.reactionType && acceptedReactionTypes.has(candidate.reactionType)) quality = holdQuality(quality, "同日のquote reaction typeが重複しています");
    }
    const sameRoleCount = publishableCandidates.filter((item) => item.dailyRole === candidate.dailyRole).length;
    if (sameRoleCount >= 2) quality = holdQuality(quality, `同じrole ${candidate.dailyRole} は1日2本までです`);
    const projected = [...publishableCandidates.map((item) => item.quality.total), quality.total];
    const projectedAverage = projected.reduce((sum, score) => sum + score, 0) / projected.length;
    if (quality.verdict === "PASS" && projected.length >= 2 && projectedAverage < MYFANS_DAILY_AVERAGE_QUALITY_MINIMUM) {
      quality = holdQuality(quality, `日次平均Quality ${MYFANS_DAILY_AVERAGE_QUALITY_MINIMUM}未満になるためHOLD`);
    }
    return { ...candidate, quality };
  };

  for (const [index, item] of rotation.entries()) {
    const excludedProducts = new Set(usedProductIds);
    let selected: ReturnType<typeof evaluateDiversity> | null = null;
    let previousHold = "";
    for (let attempt = 0; attempt < MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS; attempt += 1) {
      const candidate = evaluateDiversity(buildCandidate(item, index, attempt, excludedProducts));
      const holdReason = candidate.quality.verdict === "PASS" ? "" : classifyHoldReason(candidate.quality);
      if (attempt === 0) initialAttempts.push({ slot: item.slot, postType: candidate.postType, score: candidate.quality.total, verdict: candidate.quality.verdict, holdReason });
      recoveryHistory.push({
        slot: item.slot,
        attempt: attempt + 1,
        candidateId: candidate.id,
        productId: candidate.product?.id ?? null,
        quoteCandidateId: candidate.quoteXUrl ? analytics.quoteCandidates.find((quote) => quoteUrlFromCandidate(quote) === candidate.quoteXUrl || quote.x_post_url === candidate.quoteXUrl)?.id ?? null : null,
        initialRole: roleFor(item.postType, item.linkStrategy, "text_only"),
        recoveryRole: candidate.dailyRole,
        role: candidate.postType,
        hook: candidate.hookLabel,
        creative: candidate.creativeStrategy,
        score: candidate.quality.total,
        verdict: candidate.quality.verdict,
        holdReason,
        copyAngle: candidate.copyAngle,
        reasonToCare: candidate.topicValue?.reasonToCare ?? null,
        topicIdentity: candidate.topicIdentity,
        topicSemanticKey: candidate.topicSemanticKey,
        qualityReasons: candidate.quality.reasons,
        recoveryAction: candidate.quality.verdict === "PASS" ? (previousHold ? `${previousHold}から回復` : "初回PASS") : recoveryActionFor(holdReason, item.postType, fallbackPostTypes(item.postType)[(attempt + 1) % fallbackPostTypes(item.postType).length], attempt),
      });
      if (candidate.quality.verdict === "PASS" && candidate.quality.total >= MYFANS_QUALITY_GATE_MINIMUM) {
        selected = candidate;
        break;
      }
      previousHold = holdReason;
      if (candidate.product?.id && !allowSameProductAcrossDistinctRoles && (attempt + 1) % MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC === 0) excludedProducts.add(candidate.product.id);
    }
    if (selected) {
      if (!allowSameProductAcrossDistinctRoles) usedProductIds.add(selected.product?.id ?? -1);
      acceptedBodies.push(selected.body);
      if (selected.topicIdentity) acceptedTopicIdentities.add(selected.topicIdentity);
      if (selected.topicSemanticKey) acceptedTopicSemanticKeys.push(selected.topicSemanticKey);
      if (selected.reasonToCare) acceptedReasonCounts.set(selected.reasonToCare, (acceptedReasonCounts.get(selected.reasonToCare) ?? 0) + 1);
      if (selected.product) {
        const creatorKey = creatorKeyFromProduct(selected.product);
        acceptedCreatorCounts.set(creatorKey, (acceptedCreatorCounts.get(creatorKey) ?? 0) + 1);
      }
      if (selected.creativeStrategy === "quote_post" && selected.quoteXUrl && selected.product) {
        const quote = analytics.quoteCandidates.find((item) => quoteUrlFromCandidate(item) === selected.quoteXUrl || item.x_post_url === selected.quoteXUrl);
        acceptedQuoteCreators.add(quote ? creatorKeyFromQuote(quote) : creatorKeyFromProduct(selected.product));
        if (selected.reactionType) acceptedReactionTypes.add(selected.reactionType);
      }
      publishableCandidates.push(selected);
    } else {
      const last = recoveryHistory.filter((history) => history.slot === item.slot).at(-1);
      heldCandidates.push({
        ...buildCandidate(item, index, MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS - 1, excludedProducts),
        quality: {
          total: last?.score ?? 0,
          verdict: "HOLD",
          breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: 0, specificity: 0, proof: 0, broadCuriosity: 0, audience: 0, followReason: 0, attentionValue: 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 },
          reasons: [`${MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS}回再探索してもQuality Gateを通過しませんでした`, last?.holdReason ?? ""].filter(Boolean),
        },
      });
    }
  }

  if (publishableCandidates.length < rotation.length) {
    const attentionBackfill: RotationItem = {
      postType: "discovery_interest",
      linkStrategy: "no_link",
      objective: "impression",
      cta: "保存用の発見メモ",
      slot: "attention-backfill",
      role: "露出を作る / verified quote backfill",
    };
    for (let attempt = 0; attempt < MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS * 2 && publishableCandidates.length < rotation.length; attempt += 1) {
      const index = publishableCandidates.length + attempt;
      const candidate = evaluateDiversity(buildCandidate(attentionBackfill, index, attempt, usedProductIds));
      const holdReason = candidate.quality.verdict === "PASS" ? "" : classifyHoldReason(candidate.quality);
      recoveryHistory.push({
        slot: rotation[publishableCandidates.length]?.slot ?? attentionBackfill.slot,
        attempt: attempt + 1,
        candidateId: candidate.id,
        productId: candidate.product?.id ?? null,
        quoteCandidateId: candidate.quoteXUrl ? analytics.quoteCandidates.find((quote) => quoteUrlFromCandidate(quote) === candidate.quoteXUrl || quote.x_post_url === candidate.quoteXUrl)?.id ?? null : null,
        initialRole: "ATTENTION",
        recoveryRole: candidate.dailyRole,
        role: candidate.postType,
        hook: candidate.hookLabel,
        creative: candidate.creativeStrategy,
        score: candidate.quality.total,
        verdict: candidate.quality.verdict,
        holdReason,
        copyAngle: candidate.copyAngle,
        reasonToCare: candidate.topicValue?.reasonToCare ?? null,
        topicIdentity: candidate.topicIdentity,
        topicSemanticKey: candidate.topicSemanticKey,
        qualityReasons: candidate.quality.reasons,
        recoveryAction: candidate.quality.verdict === "PASS" ? "Attention verified quote backfillで回復" : recoveryActionFor(holdReason, attentionBackfill.postType, attentionBackfill.postType, attempt),
      });
      if (candidate.quality.verdict !== "PASS" || candidate.quality.total < MYFANS_QUALITY_GATE_MINIMUM) continue;
      if (!allowSameProductAcrossDistinctRoles) usedProductIds.add(candidate.product?.id ?? -1);
      acceptedBodies.push(candidate.body);
      if (candidate.topicIdentity) acceptedTopicIdentities.add(candidate.topicIdentity);
      if (candidate.topicSemanticKey) acceptedTopicSemanticKeys.push(candidate.topicSemanticKey);
      if (candidate.reasonToCare) acceptedReasonCounts.set(candidate.reasonToCare, (acceptedReasonCounts.get(candidate.reasonToCare) ?? 0) + 1);
      if (candidate.product) {
        const creatorKey = creatorKeyFromProduct(candidate.product);
        acceptedCreatorCounts.set(creatorKey, (acceptedCreatorCounts.get(creatorKey) ?? 0) + 1);
      }
      if (candidate.creativeStrategy === "quote_post" && candidate.quoteXUrl && candidate.product) {
        const quote = analytics.quoteCandidates.find((item) => quoteUrlFromCandidate(item) === candidate.quoteXUrl || item.x_post_url === candidate.quoteXUrl);
        acceptedQuoteCreators.add(quote ? creatorKeyFromQuote(quote) : creatorKeyFromProduct(candidate.product));
        if (candidate.reactionType) acceptedReactionTypes.add(candidate.reactionType);
      }
      publishableCandidates.push({
        ...candidate,
        plannedSlot: rotation[publishableCandidates.length]?.slot ?? candidate.plannedSlot,
      });
    }
  }

  if (publishableCandidates.length < rotation.length && topicPassRows.length >= 3 && publishableCandidates.length >= 2) {
    const base = publishableCandidates[0];
    const aggregateTopics = publishableCandidates
      .filter((candidate) => candidate.topicIdentity && candidate.topicValue?.verdict === "PASS")
      .filter((candidate, index, rows) => rows.findIndex((item) => item.topicIdentity === candidate.topicIdentity) === index)
      .slice(0, 2);
    const second = aggregateTopics.find((candidate) => candidate.id !== base.id) ?? aggregateTopics[1];
    const product = base.product;
    const aggregateScore = Math.min(100, Math.round(aggregateTopics.reduce((sum, candidate) => sum + (candidate.topicValue?.score ?? 0), 0) / Math.max(1, aggregateTopics.length)) + 4);
    const aggregateTopic: MyfansTopicValue | null = aggregateTopics.length >= 2
      ? {
        score: aggregateScore,
        verdict: "PASS",
        reasonToCare: "clear_comparison",
        evidence: aggregateTopics.flatMap((candidate) => candidate.topicValue?.evidence.slice(0, 1) ?? []),
        baseline: aggregateTopics.flatMap((candidate) => candidate.topicValue?.baseline.slice(0, 1) ?? []),
        whyRejected: [],
        breakdown: {
          surprise: 18,
          concreteDifference: 20,
          humanCuriosity: 18,
          socialProofMomentum: 12,
          visualStoryValue: 12,
          explainability: 10,
        },
      }
      : null;
    if (product && second && aggregateTopic?.verdict === "PASS" && aggregateTopic.score >= topicThresholdFor("DISCOVERY")) {
      const aggregateBody = fitXBody([
        "今日の2つ、引っかかる場所が全然違う。",
        "一方は見た瞬間の違い、もう一方は反応の残り方で気になる。",
      ], 210);
      const hook = hookIntelligence(product, null);
      const quality = qualityScoreFor({
        body: aggregateBody,
        product,
        postType: "ranking_note",
        linkStrategy: "no_link",
        creativeStrategy: "discovery_card",
        quote: null,
        hook: hook.hook,
        attentionScore: 90,
        topicValue: aggregateTopic,
      });
      const candidate = {
        ...base,
        id: `${planDate}-${stage}-authority-aggregate-topic-${publishableCandidates.length + 1}`,
        body: aggregateBody,
        selfReply: "",
        affiliateUrl: "",
        quoteXUrl: "",
        creativeStrategy: "discovery_card" as MyfansCreativeStrategy,
        dailyRole: "DISCOVERY" as DailyRole,
        postType: "ranking_note",
        linkStrategy: "no_link" as MyfansLinkStrategy,
        creativeVariantId: `${planDate}-${stage}-authority-aggregate-topic-${publishableCandidates.length + 1}`,
        plannedSlot: rotation[publishableCandidates.length]?.slot ?? "aggregate",
        objective: "follow" as MyfansObjective,
        role: "Discovery aggregate / Topic通過候補を束ねる",
        reason: "Topic通過候補が同一の強い根拠に偏ったため、単独投稿の水増しではなく発見枠と選別枠の差を束ねます。",
        topicValue: aggregateTopic,
        topicIdentity: `aggregate:${aggregateTopics.map((candidate) => candidate.topicIdentity).join("|")}`,
        topicSemanticKey: `aggregate:${aggregateTopics.map((candidate) => candidate.topicSemanticKey).join("|")}`,
        topicThreshold: topicThresholdFor("DISCOVERY"),
        copyAngle: "editorial_insight" as CopySearchAngle,
        multiAngleAttempt: 1,
        reasonToCare: aggregateTopic.reasonToCare,
        quality,
        qualityReasons: quality.reasons,
      };
      const leak = detectPublicCopyLeak(candidate.body);
      const diversityIssue = hasPublicCopyDiversityIssue(candidate.body, acceptedBodies);
      const checked = leak.hasLeak
        ? { ...candidate, quality: holdQuality(candidate.quality, `Public Copy leak: ${leak.matches.join(" / ")}`) }
        : diversityIssue
          ? { ...candidate, quality: holdQuality(candidate.quality, diversityIssue) }
          : aggregateTopics.length < 2
            ? { ...candidate, quality: holdQuality(candidate.quality, "aggregateは2つ以上の異なるtopic_identityが必要です") }
          : candidate;
      if (checked.quality.verdict === "PASS" && checked.quality.total >= MYFANS_QUALITY_GATE_MINIMUM) {
        publishableCandidates.push(checked);
        acceptedBodies.push(checked.body);
        recoveryHistory.push({
          slot: checked.plannedSlot,
          attempt: 1,
          candidateId: checked.id,
          productId: checked.product?.id ?? null,
          quoteCandidateId: aggregateTopic ? topicPassRows[0]?.quoteCandidateId ?? null : null,
          initialRole: "DISCOVERY",
          recoveryRole: "DISCOVERY",
          role: "ranking_note",
          hook: checked.hookLabel,
          creative: checked.creativeStrategy,
          score: checked.quality.total,
          verdict: checked.quality.verdict,
          holdReason: "",
          copyAngle: checked.copyAngle,
          reasonToCare: checked.topicValue?.reasonToCare ?? null,
          topicIdentity: checked.topicIdentity,
          topicSemanticKey: checked.topicSemanticKey,
          qualityReasons: checked.quality.reasons,
          recoveryAction: "Discovery aggregateで回復",
        });
      } else {
        recoveryHistory.push({
          slot: candidate.plannedSlot,
          attempt: 1,
          candidateId: candidate.id,
          productId: candidate.product?.id ?? null,
          quoteCandidateId: topicPassRows[0]?.quoteCandidateId ?? null,
          initialRole: "DISCOVERY",
          recoveryRole: "DISCOVERY",
          role: "ranking_note",
          hook: candidate.hookLabel,
          creative: candidate.creativeStrategy,
          score: checked.quality.total,
          verdict: checked.quality.verdict,
          holdReason: classifyHoldReason(checked.quality),
          copyAngle: candidate.copyAngle,
          reasonToCare: candidate.topicValue?.reasonToCare ?? null,
          topicIdentity: candidate.topicIdentity,
          topicSemanticKey: candidate.topicSemanticKey,
          qualityReasons: checked.quality.reasons,
          recoveryAction: "Discovery aggregateもQuality Gate未達",
        });
      }
    }
  }

  const linkedCount = publishableCandidates.filter((candidate) => candidate.linkStrategy === "body_link" || candidate.linkStrategy === "reply_link").length;
  const noDirectLinkCount = publishableCandidates.length - linkedCount;
  const strategy = MYFANS_30_DAY_STRATEGY[stage];

  return {
    day,
    planDate,
    planKey,
    stage,
    strategy,
    profileGuide: MYFANS_PROFILE_GUIDE,
    candidates: publishableCandidates,
    heldCandidates,
    linkedCount,
    noDirectLinkCount,
    learning,
    quotePool,
    topicValue: {
      funnel: { ...candidateFunnel, final: publishableCandidates.length },
      top10: topicRows.slice(0, 10),
      rejected: topicRows.filter((row) => row.topicValue.verdict === "LOW_TOPIC_VALUE").slice(0, 20),
    },
    planningReason: planningReasonFor(stage, learning),
    todayStrategy: buildTodayStrategy(analytics, publishableCandidates, heldCandidates, quotePool),
    recovery: {
      targetPosts: rotation.length,
      passCount: publishableCandidates.length,
      attemptedCandidates: recoveryHistory.length,
      initialAttempts,
      history: recoveryHistory,
      summary: publishableCandidates.length >= rotation.length
        ? `目標${rotation.length}本すべてQuality Gate ${MYFANS_QUALITY_GATE_MINIMUM}+で通過`
        : `目標${rotation.length}本中${publishableCandidates.length}本PASS。候補不足またはGate未達`,
      roleSwaps: recoveryHistory.filter((row) => /→/.test(row.recoveryAction) || /Recovery/.test(row.candidateId)),
    },
    outboundTasks: buildOutboundTasks(analytics, quotePool),
    profileFunnel: buildProfileFunnel(analytics),
    bottleneck: buildBottleneck(analytics),
  };
}

type DailyCandidate = {
  postType: string;
  creativeStrategy: MyfansCreativeStrategy;
  dailyRole: DailyRole;
  plannedSlot: string;
  hookLabel: string;
  audienceIntent: AudienceIntent;
  quality: { total: number; verdict: string; reasons: string[] };
};

function buildTodayStrategy(
  analytics: MyfansAnalytics,
  candidates: DailyCandidate[],
  heldCandidates: DailyCandidate[],
  quotePool: ReturnType<typeof buildMyfansQuotePool>,
) {
  const diagnosis = analytics.xAccountGrowth.diagnosis;
  const samplePosts = analytics.posts.filter((post) => post.status === "posted").length;
  const quoteCount = candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").length;
  const discoveryCount = candidates.filter((candidate) => candidate.dailyRole === "DISCOVERY").length;
  const authorityCount = candidates.filter((candidate) => candidate.dailyRole === "AUTHORITY").length;
  const cardCount = candidates.filter((candidate) => ["ranking_card", "comparison_card", "discovery_card"].includes(candidate.creativeStrategy)).length;
  const textCount = candidates.filter((candidate) => candidate.creativeStrategy === "text_only").length;
  const revenueCount = candidates.filter((candidate) => candidate.dailyRole === "REVENUE").length;
  const topAttention = quotePool.global[0];
  const mainTheme = topAttention?.candidate.quote_visual_ready
    ? "verified visual quoteを入口にして露出を取りにいく"
    : cardCount > 0
      ? "明確な数字差がある候補だけカード化する"
      : "弱いカードを止めてtext/quote中心にする";
  const changed = [
    "日付ごとのplan keyで候補順に変化を入れました",
    heldCandidates.length ? `Quality Gate未達 ${heldCandidates.length}本を本日の投稿から外しました` : "Quality Gateを通過した候補だけ表示しています",
    cardCount ? "Data Story Scoreが足りるカードだけ採用しています" : "価格だけの弱いカードは採用していません",
    quoteCount ? "Attention枠はverified visual quoteを優先しています" : "verified visual quote不足のため引用を主力にしていません",
  ];
  return {
    stageLabel: samplePosts < MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts ? "Exposure / Learning" : diagnosis,
    kpi: diagnosis === "露出不足" ? "表示獲得 → プロフィール流入 → フォロー" : "反応が出た型 → プロフィール/クリックへ接続",
    composition: { quote: quoteCount, discovery: discoveryCount, authority: authorityCount, card: cardCount, text: textCount, revenue: revenueCount, total: candidates.length },
    mainTheme,
    winningNarrative: `今日は${mainTheme}日です。${diagnosis}のため、Revenue本数を増やすより先に、X上で止まる理由とフォロー理由を分けて検証します。`,
    changedFromYesterday: changed,
  };
}

function buildOutboundTasks(analytics: MyfansAnalytics, quotePool: ReturnType<typeof buildMyfansQuotePool>) {
  const externalTasks = quotePool.global.slice(0, 3).map((row, index) => {
    const opening = row.candidate.text_excerpt
      ? `この「${row.candidate.text_excerpt.slice(0, 24)}」の入り方、すぐ内容が伝わるのが強いです。`
      : `${quoteInsight(row.candidate)}まで伸びているの、かなり目に留まります。`;
    const second = index === 0
      ? "こういう一目で分かれる投稿、あとで探す時に助かります。"
      : index === 1
        ? "反応の付き方まで含めて、好きな人には見つけやすいです。"
        : "別角度の比較としても覚えておきたいです。";
    const suggestedText = [opening, second].join("\n");
    const leak = detectPublicCopyLeak(suggestedText);
    return {
      id: `outbound-${row.candidate.id}`,
      type: index === 0 ? "quote_candidate" : "reply_candidate",
      targetUrl: quoteUrlFromCandidate(row.candidate),
      creator: row.candidate.source_x_handle ? `@${row.candidate.source_x_handle}` : row.candidate.creator_x_url,
      reason: row.candidate.quote_visual_ready
        ? `内部判断: ${row.candidate.media_type} / Attention ${row.globalScore}。`
        : `内部判断: Attention ${row.globalScore}。引用より返信で文脈確認。`,
      suggestedText: leak.hasLeak ? "" : suggestedText,
      guardrail: leak.hasLeak ? `HOLD: ${leak.matches.join(" / ")}` : "自動送信しません。同文の大量返信は禁止です。",
    };
  });
  return externalTasks.concat(analytics.posts.filter((post) => post.status === "posted" && (post.replies_count > 0 || post.likes_count > 0)).slice(0, 2).map((post) => ({
    id: `own-reply-${post.id}`,
    type: "own_reply_followup",
    targetUrl: post.x_post_url,
    creator: "@lumi_reviw",
    reason: `自分の投稿に反応があります。表示 ${post.impressions} / いいね ${post.likes_count} / 返信 ${post.replies_count}。`,
    suggestedText: "反応があった視点を、次の比較メモに反映します。",
    guardrail: "返信は相手の文脈が確認できる時だけ行います。",
  })));
}

function buildProfileFunnel(analytics: MyfansAnalytics) {
  const rows = analytics.xAccountGrowth;
  const visitToFollow = rows.profileVisits30d > 0 ? rows.newFollows30d / rows.profileVisits30d : null;
  const enough = rows.profileVisits30d >= 20;
  return {
    profileHealth: rows.currentFollowers === 0 ? "初期状態" : "運用中",
    fixedPostHealth: "最低限あり。7日ごとに反応を見て改善",
    visitToFollowRate: visitToFollow,
    diagnosis: enough
      ? visitToFollow !== null && visitToFollow >= MYFANS_DIAGNOSIS_THRESHOLDS.followRate ? "プロフィールは機能しています" : "プロフィール訪問からフォローへの理由が弱い可能性があります"
      : "データ不足",
    recommendation: enough
      ? "固定ポストは、探す手間が減る約束を1行目に置いて検証します。"
      : "まず表示とプロフィール訪問の母数を作ります。",
  };
}

function buildBottleneck(analytics: MyfansAnalytics) {
  const growth = analytics.xAccountGrowth;
  const bottleneck = growth.impressions30d < MYFANS_DIAGNOSIS_THRESHOLDS.exposureImpressions
    ? "Exposure"
    : growth.profileVisits30d <= 0
      ? "ProfileVisit"
      : growth.newFollows30d <= 0
        ? "Follow"
        : growth.clicks30d <= 0
          ? "Click"
          : growth.conversions30d <= 0
            ? "CV"
            : "Revenue";
  return {
    current: bottleneck,
    shouldIncreaseRevenue: bottleneck === "Click" || bottleneck === "CV" || bottleneck === "Revenue",
    explanation: bottleneck === "Exposure"
      ? "今はRevenue投稿を増やす段階ではありません。まず表示を増やします。"
      : bottleneck === "Follow"
        ? "プロフィールを見る人は出ていますが、フォロー理由を強くする段階です。"
        : "収益導線を少しずつ検証できます。",
  };
}

function summarizeProductStats(analytics: MyfansAnalytics) {
  const map = new Map<number, { impressions: number; clicks: number; conversions: number; reward: number }>();
  for (const post of analytics.posts) {
    if (!post.product_id) continue;
    const row = map.get(post.product_id) ?? { impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    row.impressions += post.impressions;
    row.clicks += post.clicks ?? 0;
    map.set(post.product_id, row);
  }
  for (const conversion of analytics.conversions) {
    if (!conversion.product_id) continue;
    const row = map.get(conversion.product_id) ?? { impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    row.conversions += 1;
    row.reward += conversion.reward_amount;
    map.set(conversion.product_id, row);
  }
  return map;
}

function reasonFor(stage: MyfansGrowthStage, linkStrategy: MyfansLinkStrategy, objective: MyfansObjective) {
  if (stage === "day_1_7" && (linkStrategy === "no_link" || linkStrategy === "profile_cta")) {
    return "最初の7日は販売より、表示とプロフィール遷移を作るため。";
  }
  if (stage === "day_8_14") return "少しずつリンク型も混ぜ、反応差を見るため。";
  if (objective === "conversion") return "クリックやフォローに寄与した型を増やす段階のため。";
  return "少サンプルでは断定せず、固定ローテーションを優先します。";
}

export function summarizeTodayActions(analytics: MyfansAnalytics) {
  const samplePosts = analytics.posts.filter((post) => post.status === "posted").length;
  if (samplePosts < MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts) {
    return ["Day1-7は4本で検証する", "リンクなし/プロフィール誘導を先に出す", "リンク付きは1本だけ小さく試す"];
  }
  return analytics.xAccountGrowth.diagnosis.includes("クリック")
    ? ["プロフィール誘導を1本、自己リプリンクを1本にする", "クリックが出た投稿型を再利用する"]
    : ["表示が取れた投稿型を1本再利用する", "プロフィール文と固定ポストの受け皿を見直す"];
}

export function buildQuoteCandidateCollectionTasks(analytics: MyfansAnalytics): MyfansQuoteCollectionTask[] {
  const quotePool = buildMyfansQuotePool(analytics);
  const globalRankByUrl = new Map(quotePool.global.map((row, index) => [row.candidate.x_post_url, index + 1]));
  const selectedUrls = new Set(quotePool.selected.map((row) => quoteUrlFromCandidate(row.candidate)));
  const productsByCreator = new Map<number, MyfansProduct[]>();
  for (const product of analytics.products) {
    if (!product.creator_id || product.status === "paused" || product.status === "rejected") continue;
    productsByCreator.set(product.creator_id, [...(productsByCreator.get(product.creator_id) ?? []), product]);
  }
  const rows = analytics.creators
    .filter((creator) => creator.is_active && creator.creator_x_url)
    .map((creator) => {
      const products = (productsByCreator.get(creator.id) ?? [])
        .sort((a, b) => (b.selection_score ?? 0) - (a.selection_score ?? 0));
      const product = products[0] ?? null;
      const key = creatorKeyFromCreator(creator);
      return {
        creator,
        product,
        creatorName: creator.display_name || creator.creator_x_url || "myfans creator",
        candidates: analytics.quoteCandidates.filter((candidate) => creatorKeyFromQuote(candidate) === key),
      };
    });
  return Array.from(rows.values())
    .map(({ creator, product, creatorName, candidates }) => {
      const topCandidates = candidates
        .filter((candidate) => (candidate.creator_rank ?? 99) <= 3 && candidate.score >= QUOTE_MIN_SCORE)
        .sort((a, b) => (a.creator_rank ?? 99) - (b.creator_rank ?? 99) || b.score - a.score)
        .slice(0, 3)
        .map((candidate) => ({
          rank: candidate.creator_rank ?? 0,
          xPostUrl: candidate.x_post_url,
          quoteUrl: quoteUrlFromCandidate(candidate),
          mediaType: candidate.media_type ?? "none",
          quoteVisualReady: Boolean(candidate.quote_visual_ready),
          urlKind: (candidate.quote_visual_ready && candidate.media_permalink ? "media_permalink" : "status") as "media_permalink" | "status",
          score: candidate.score,
          reason: candidate.score_reason,
        }));
      const lastCollectedAt = candidates.sort((a, b) => String(b.collected_at).localeCompare(String(a.collected_at)))[0]?.collected_at ?? null;
      const age = daysSinceIso(lastCollectedAt);
      return {
        creator,
        product,
        creatorName,
        candidates,
        topCandidates,
        lastCollectedAt,
        refreshPriority: candidates.length < 5 ? 100 : age === null ? 80 : age >= QUOTE_REFRESH_DAYS ? 60 + age : 0,
      };
    })
    .sort((a, b) => b.refreshPriority - a.refreshPriority || ((b.topCandidates[0]?.score ?? 0) - (a.topCandidates[0]?.score ?? 0)))
    .slice(0, 3)
    .map(({ creator, product, creatorName, candidates, topCandidates, lastCollectedAt }) => ({
      id: `quote-creator-${creator.id}`,
      creatorName,
      creatorXUrl: creator.creator_x_url ?? "",
      sourceXHandle: (creator.source_x_handle ?? "").replace(/^@/, "") || creator.creator_x_url?.match(/x\.com\/([^/?#]+)/)?.[1] || "",
      creatorId: creator.id,
      productId: product?.id ?? null,
      productTitle: product?.title ?? "creator単位で収集",
      instruction: "creator本人のXプロフィールを開き、Companionで表示中の最新5-20件を収集します。投稿選択はシステムが行います。",
      collectedCount: candidates.length,
      topCandidates,
      topScore: topCandidates[0]?.score ?? null,
      globalRank: topCandidates[0] ? globalRankByUrl.get(topCandidates[0].xPostUrl) ?? null : null,
      selectedForToday: topCandidates.some((candidate) => selectedUrls.has(candidate.quoteUrl)),
      lastCollectedAt,
      nextRefreshLabel: addDaysIso(lastCollectedAt, QUOTE_REFRESH_DAYS)?.slice(0, 10) ?? "未収集",
      plannedSlot: "次回の discovery_interest / profile_cta 枠",
    }));
}

export function compareByStrategy(posts: MyfansXPost[], conversions: MyfansAnalytics["conversions"]) {
  const groups = new Map<string, { key: string; posts: number; impressions: number; clicks: number; conversions: number; reward: number }>();
  for (const post of posts) {
    const key = `${post.link_strategy ?? "未設定"} / ${post.post_type}`;
    const current = groups.get(key) ?? { key, posts: 0, impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    current.posts += 1;
    current.impressions += post.impressions;
    current.clicks += post.clicks ?? 0;
    groups.set(key, current);
  }
  for (const conversion of conversions) {
    const post = posts.find((item) => item.id === conversion.x_post_id);
    const key = `${post?.link_strategy ?? "未設定"} / ${post?.post_type ?? "未紐付け"}`;
    const current = groups.get(key) ?? { key, posts: 0, impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    current.conversions += 1;
    current.reward += conversion.reward_amount;
    groups.set(key, current);
  }
  return Array.from(groups.values()).map((row) => ({
    ...row,
    impressionsPerPost: row.posts > 0 ? Math.round(row.impressions / row.posts) : 0,
    clicksPerPost: row.posts > 0 ? Number((row.clicks / row.posts).toFixed(2)) : 0,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
    cvr: row.clicks > 0 ? row.conversions / row.clicks : null,
    rewardPerPost: row.posts > 0 ? Math.round(row.reward / row.posts) : 0,
    expectedRewardPer1000Impressions: row.impressions > 0 ? Math.round((row.reward / row.impressions) * 1000) : 0,
    verdict: row.posts < MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts ? "サンプル不足" : row.reward > 0 || row.clicks / Math.max(1, row.impressions) >= MYFANS_DIAGNOSIS_THRESHOLDS.clickRate ? "勝ち型" : "負け型",
  }));
}

export type MyfansLearningAxis = "post_type" | "link_strategy" | "objective" | "growth_stage" | "creator" | "product";
export type MyfansCreativeLearningAxis = MyfansLearningAxis | "creative_strategy";

function labelForAxis(axis: MyfansCreativeLearningAxis, post: MyfansXPost, analytics: MyfansAnalytics) {
  if (axis === "post_type") return post.post_type || "未設定";
  if (axis === "link_strategy") return post.link_strategy || "未設定";
  if (axis === "creative_strategy") return post.creative_strategy || "未設定";
  if (axis === "objective") return post.objective || "未設定";
  if (axis === "growth_stage") return post.growth_stage || "未設定";
  const product = analytics.products.find((item) => item.id === post.product_id);
  if (axis === "product") return product?.title ?? "商品未紐付け";
  const creator = analytics.creators.find((item) => item.id === product?.creator_id);
  return creator?.display_name ?? "クリエイター未紐付け";
}

function compareByAxis(analytics: MyfansAnalytics, axis: MyfansCreativeLearningAxis, days: number) {
  const periodPosts = analytics.posts.filter((post) => inPeriod(post.posted_at ?? post.created_at, days));
  const periodConversions = analytics.conversions.filter((conversion) => inPeriod(conversion.occurred_at, days));
  const accountRows = (analytics.xAccountMetrics ?? []).filter((row) => inPeriod(row.metric_date, days));
  const accountProfileVisits = accountRows.reduce((sum, row) => sum + row.profile_visits, 0);
  const firstFollowers = accountRows[0]?.followers_count ?? 0;
  const latestFollowers = accountRows[accountRows.length - 1]?.followers_count ?? firstFollowers;
  const groups = new Map<string, { key: string; posts: number; impressions: number; clicks: number; conversions: number; reward: number }>();
  for (const post of periodPosts) {
    const key = labelForAxis(axis, post, analytics);
    const row = groups.get(key) ?? { key, posts: 0, impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    row.posts += 1;
    row.impressions += post.impressions;
    row.clicks += post.clicks ?? 0;
    groups.set(key, row);
  }
  for (const conversion of periodConversions) {
    const post = periodPosts.find((item) => item.id === conversion.x_post_id);
    const key = post ? labelForAxis(axis, post, analytics) : "投稿未紐付け";
    const row = groups.get(key) ?? { key, posts: 0, impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    row.conversions += 1;
    row.reward += conversion.reward_amount;
    groups.set(key, row);
  }
  const estimatedProfileVisitsPerPost = periodPosts.length > 0 ? accountProfileVisits / periodPosts.length : 0;
  const estimatedFollowsPerPost = periodPosts.length > 0 ? Math.max(0, latestFollowers - firstFollowers) / periodPosts.length : 0;
  return Array.from(groups.values()).map((row) => {
    const ctr = row.impressions > 0 ? row.clicks / row.impressions : null;
    const cvr = row.clicks > 0 ? row.conversions / row.clicks : null;
    const rewardPerPost = row.posts > 0 ? row.reward / row.posts : 0;
    const realizedRewardPer1000Impressions = row.impressions > 0 ? Math.round((row.reward / row.impressions) * 1000) : 0;
    const confidence = Math.min(1, row.posts / MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts * 0.55 + row.clicks / 20 * 0.45);
    const winner = confidence >= 0.55 && (row.reward > 0 || (ctr ?? 0) >= MYFANS_DIAGNOSIS_THRESHOLDS.clickRate || estimatedFollowsPerPost >= 0.2);
    return {
      ...row,
      impressionsPerPost: row.posts > 0 ? Math.round(row.impressions / row.posts) : 0,
      profileVisitsPerPostEstimate: Number(estimatedProfileVisitsPerPost.toFixed(2)),
      followsDeltaPerPostEstimate: Number(estimatedFollowsPerPost.toFixed(2)),
      clicksPerPost: row.posts > 0 ? Number((row.clicks / row.posts).toFixed(2)) : 0,
      ctr,
      cvr,
      rewardPerPost: Math.round(rewardPerPost),
      realizedRewardPer1000Impressions,
      confidence: Number(confidence.toFixed(2)),
      verdict: confidence < 0.55 ? "サンプル不足" : winner ? "勝ち型" : "負け型",
      attributionNote: "profile visits/followsは投稿へ厳密帰属できないため account-level estimate",
    };
  }).sort((a, b) => b.confidence - a.confidence || b.realizedRewardPer1000Impressions - a.realizedRewardPer1000Impressions || b.clicksPerPost - a.clicksPerPost);
}

export function buildMyfansLearning(analytics: MyfansAnalytics) {
  const axes: MyfansCreativeLearningAxis[] = ["post_type", "link_strategy", "creative_strategy", "objective", "growth_stage", "creator", "product"];
  const buildPeriod = (days: number) => Object.fromEntries(axes.map((axis) => [axis, compareByAxis(analytics, axis, days)])) as Record<MyfansCreativeLearningAxis, ReturnType<typeof compareByAxis>>;
  return {
    seven: buildPeriod(PERIOD_DAYS.seven),
    thirty: buildPeriod(PERIOD_DAYS.thirty),
  };
}

function bestTrustedPattern(learning: ReturnType<typeof buildMyfansLearning>, period: "seven" | "thirty") {
  return learning[period].link_strategy.find((row) => row.verdict === "勝ち型" && row.confidence >= 0.55);
}

function adjustRotationByLearning<T extends { linkStrategy: MyfansLinkStrategy; objective: MyfansObjective; postType: string; role: string }>(
  rotation: T[],
  stage: MyfansGrowthStage,
  learning: ReturnType<typeof buildMyfansLearning>,
) {
  if (stage === "day_1_7") return rotation;
  const sevenWinner = bestTrustedPattern(learning, "seven");
  const thirtyWinner = bestTrustedPattern(learning, "thirty");
  const winner = stage === "day_8_14" ? sevenWinner : sevenWinner ?? thirtyWinner;
  if (!winner || !["body_link", "reply_link", "profile_cta", "no_link"].includes(winner.key)) return rotation;
  return rotation.map((item, index) => index === rotation.length - 1 ? { ...item, linkStrategy: winner.key as MyfansLinkStrategy, role: `${item.role} / 学習結果を少し反映` } : item);
}

function planningReasonFor(stage: MyfansGrowthStage, learning: ReturnType<typeof buildMyfansLearning>) {
  if (stage === "day_1_7") return "Day1-7は固定ローテーションを優先します。";
  const sevenWinner = bestTrustedPattern(learning, "seven");
  if (stage === "day_8_14") return sevenWinner ? `7日学習で信頼できる ${sevenWinner.key} に1枠だけ寄せています。` : "7日学習が少サンプルのため固定配分へフォールバックしています。";
  const thirtyWinner = bestTrustedPattern(learning, "thirty");
  return sevenWinner || thirtyWinner ? `7日/30日学習で信頼できる ${(sevenWinner ?? thirtyWinner)?.key} に寄せています。` : "7日/30日とも少サンプルのため固定配分へフォールバックしています。";
}

export function buildCreatorPartnershipCandidates(analytics: MyfansAnalytics) {
  const productsByCreator = new Map<number, MyfansProduct[]>();
  for (const product of analytics.products) {
    if (!product.creator_id) continue;
    productsByCreator.set(product.creator_id, [...(productsByCreator.get(product.creator_id) ?? []), product]);
  }
  return analytics.creators.map((creator) => {
    const products = productsByCreator.get(creator.id) ?? [];
    const productIds = new Set(products.map((product) => product.id));
    const posts = analytics.posts.filter((post) => post.product_id && productIds.has(post.product_id));
    const conversions = analytics.conversions.filter((conversion) => conversion.product_id && productIds.has(conversion.product_id));
    const impressions = posts.reduce((sum, post) => sum + post.impressions, 0);
    const clicks = posts.reduce((sum, post) => sum + (post.clicks ?? 0), 0);
    const reward = conversions.reduce((sum, conversion) => sum + conversion.reward_amount, 0);
    const avgScores = products.map((product) =>
      calculateMyfansOpportunityScores({
        price: product.price,
        rewardRate: product.reward_rate,
        planSignupReward: product.plan_signup_reward,
        recurringRewardRate: product.recurring_reward_rate,
        popularityRank: product.popularity_rank,
        likesCount: product.likes_count,
        savesCount: product.saves_count,
        isNew: product.is_new,
        hasAffiliateUrl: Boolean(product.affiliate_url),
        hasApprovedMedia: Boolean(product.approved_media_name || product.affiliate_media_id),
        source_x_url: product.source_x_url,
        creatorProductCount: products.length,
        pastImpressions: impressions,
        pastClicks: clicks,
        pastConversions: conversions.length,
        pastReward: reward,
      }),
    );
    const revenueScore = avgScores.length ? Math.round(avgScores.reduce((sum, row) => sum + row.revenueScore, 0) / avgScores.length) : 0;
    const creatorLtvScore = avgScores.length ? Math.round(avgScores.reduce((sum, row) => sum + row.creatorLtvScore, 0) / avgScores.length) : 0;
    const priority = reward > 0 || clicks >= 5 || creatorLtvScore >= 65 ? "直接提携候補" : revenueScore >= 55 || creatorLtvScore >= 55 ? "個別報酬率交渉候補" : "継続観測";
    return {
      creator,
      products: products.length,
      impressions,
      clicks,
      conversions: conversions.length,
      reward,
      revenueScore,
      creatorLtvScore,
      priority,
      reason: `${products.length}商品 / ${clicks}クリック / ${conversions.length}成果。実績が少ない場合は候補止まりで扱います。`,
      messageDraft: `${creator.display_name}様\nいつも作品を拝見しています。Xの発見・比較投稿で反応が出ているため、掲載条件や個別報酬率についてご相談できればと思いご連絡しました。`,
    };
  }).sort((a, b) => b.reward - a.reward || b.clicks - a.clicks || b.creatorLtvScore - a.creatorLtvScore).slice(0, 8);
}
