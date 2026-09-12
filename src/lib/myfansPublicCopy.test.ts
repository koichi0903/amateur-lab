import assert from "node:assert/strict";
import { isValidMyfansAffiliateUrl, myfansAffiliateLinkStatus, normalizeMyfansAffiliateUrl } from "@/lib/myfansAffiliateLink";
import { MYFANS_PUBLIC_COPY_GENERATOR_VERSION, MYFANS_QUALITY_GATE_MINIMUM, buildMyfansExecutionBoard, detectPublicCopyLeak, evaluateMyfansPublicCopyQuality, evaluateMyfansTopicValue, publicCopyInputHash, type PublicCopyFacts } from "@/lib/myfansXExecution";
import { analyzeMyfansQuoteVisual, selectVisualVerificationBatch } from "@/lib/myfansVisualVerification";

const leakingBodies = [
  "ブラウザでvisual表示まで確認した候補です",
  "推定報酬¥2,490まで確認済み",
  "Quality Gate PASS の公開候補",
  "正規URLと報酬条件がある時だけPRにします",
  "myfans側の登録情報でも見る前の材料があります",
  "表示628,545 / いいね13,011で、流れてきても止まりやすい投稿。\n\n人気上位まで伸びていて、雰囲気だけでは終わらない。",
  "myfansを探す時間を減らしたい人向けに、今日は新着でいいね120まで付いている。\n\n過去の発掘メモはプロフィールから見られます。",
  "反応と価格のズレまで見て残す。",
  "動画の最初で空気が変わる。\n\n表示628,545 / いいね13,011。数字だけ浮いて見える。",
  "¥3,980でこの反応は目立つ。",
  "価格より先に反応の強さが目に入る。",
];

for (const body of leakingBodies) {
  assert.equal(detectPublicCopyLeak(body).hasLeak, true, body);
}

const publicBodies = [
  "画像だけで伝わるの強い。\n\n説明より先に雰囲気が入ってくる。",
  "そりゃ伸びるよな、ってなる。\n\n見せ方が分かりやすいから、知らなくても入りやすい。",
  "#PR\n詳細はこちら\nhttps://mfco.link/r/example_123",
];

for (const body of publicBodies) {
  assert.equal(detectPublicCopyLeak(body).hasLeak, false, body);
}

const hardFailBodies = [
  "myfansアフィリエイトは、X側で299万表示まで伸びている。",
  "単独の条件より、X側で299万表示まで伸びている。",
  "全体上位まで伸びたの、さすがに一回気になる。",
  "108万回も見られているなら、流れてきた理由がある。\n\nただの条件ではなく、比べた時の違いが残る。",
];

const facts: PublicCopyFacts = {
  sourceText: "最初の一枚だけ印象が違う投稿",
  creatorName: "creator",
  creatorHandle: "@creator",
  publicMetrics: {
    views: 628545,
    likes: 13011,
    reposts: 120,
    replies: 24,
    popularityRank: 8,
    productLikes: 120,
    productSaves: 35,
    price: 980,
    isNew: true,
  },
  visualContext: "image",
  quoteVisualAnalysis: null,
  productFacts: {
    title: "sample",
    genre: "sample",
  },
};

const sameHash = publicCopyInputHash(facts);
const changedHash = publicCopyInputHash({ ...facts, publicMetrics: { ...facts.publicMetrics, likes: 13012 } });
assert.equal(MYFANS_PUBLIC_COPY_GENERATOR_VERSION, "public-copy-v12-topic-value");
assert.equal(MYFANS_QUALITY_GATE_MINIMUM, 85);
assert.equal(publicCopyInputHash(facts), sameHash);
assert.notEqual(changedHash, sameHash);

const product = {
  id: 1,
  title: "新着 sample",
  product_url: "https://example.com/p/1",
  affiliate_url: "https://mfco.link/r/example_123",
  source_x_url: "",
  quote_candidate_x_url: "https://x.com/creator/status/1",
  genre: "sample",
  price: 980,
  reward_rate: 30,
  estimated_reward: 294,
  plan_signup_reward: 0,
  recurring_reward_rate: 0,
  popularity_rank: 8,
  likes_count: 120,
  saves_count: 35,
  is_new: true,
  status: "candidate",
  selection_reason: "新着で反応がある",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  creator_id: 1,
  creator_x_url: "https://x.com/creator",
  approved_media_id: 1,
  approved_media_name: "@lumi_reviw",
  media_permission_status: "unknown",
  myfans_creators: { display_name: "creator" },
};

const product2 = {
  ...product,
  id: 2,
  title: "新着 sample 2",
  product_url: "https://example.com/p/2",
  quote_candidate_x_url: "https://x.com/creator2/status/2",
  likes_count: 260,
  saves_count: 44,
  price: 0,
  creator_id: 2,
  creator_x_url: "https://x.com/creator2",
  myfans_creators: { display_name: "creator2" },
};

const product3 = {
  ...product,
  id: 3,
  title: "新着 sample 3",
  product_url: "https://example.com/p/3",
  quote_candidate_x_url: "https://x.com/creator3/status/3",
  popularity_rank: 6,
  likes_count: 180,
  saves_count: 21,
  affiliate_url: "",
  reward_rate: 0,
  estimated_reward: 0,
  creator_id: 3,
  creator_x_url: "https://x.com/creator3",
  myfans_creators: { display_name: "creator3" },
};

const product4 = {
  ...product,
  id: 4,
  title: "新着 sample 4",
  product_url: "https://example.com/p/4",
  quote_candidate_x_url: "https://x.com/creator4/status/4",
  popularity_rank: 7,
  likes_count: 140,
  saves_count: 28,
  price: 1280,
  creator_id: 4,
  creator_x_url: "https://x.com/creator4",
  myfans_creators: { display_name: "creator4" },
};

const analytics = {
  error: null,
  selectedMediaId: 1,
  selectedMedia: { id: 1, media_name: "@lumi_reviw" },
  media: [{ id: 1, media_name: "@lumi_reviw" }],
  products: [
    product,
    product2,
    product3,
    product4,
  ],
  creators: [
    { id: 1, display_name: "creator", is_active: true, creator_x_url: "https://x.com/creator", source_x_handle: "creator" },
    { id: 2, display_name: "creator2", is_active: true, creator_x_url: "https://x.com/creator2", source_x_handle: "creator2" },
    { id: 3, display_name: "creator3", is_active: true, creator_x_url: "https://x.com/creator3", source_x_handle: "creator3" },
    { id: 4, display_name: "creator4", is_active: true, creator_x_url: "https://x.com/creator4", source_x_handle: "creator4" },
  ],
  posts: [],
  conversions: [],
  xAccountMetrics: [],
  xAccountGrowth: {
    impressions30d: 0,
    profileVisits30d: 0,
    newFollows30d: 0,
    clicks30d: 0,
    conversions30d: 0,
    reward30d: 0,
    ctr30d: null,
    cvr30d: null,
    epc30d: null,
    currentFollowers: 0,
    diagnosis: "露出不足",
  },
  quoteCandidates: [{
    id: 1,
    approved_media_id: 1,
    creator_id: 1,
    product_id: 1,
    creator_x_url: "https://x.com/creator",
    source_x_handle: "creator",
    x_post_url: "https://x.com/creator/status/1",
    media_permalink: "https://x.com/creator/status/1/video/1",
    media_type: "video",
    media_count: 1,
    quote_visual_ready: true,
    media_permalink_verified_at: new Date().toISOString(),
    media_permalink_validation_status: "verified_video_permalink",
    visual_render_status: "browser_visible",
    visual_score: 85,
    posted_at: new Date().toISOString(),
    text_excerpt: "冒頭から雰囲気が変わる投稿",
    views: 120000,
    likes: 5000,
    reposts: 120,
    replies: 30,
    bookmarks: 0,
    has_image: false,
    has_video: true,
    is_pinned: false,
    is_reply: false,
    is_repost: false,
    is_quote: false,
    score: 90,
    score_reason: "visual strong",
    selected: false,
    creator_rank: 1,
    selected_for_today: false,
    last_used_at: null,
    collected_at: new Date().toISOString(),
    visual_analysis_status: "verified",
    visual_analyzer_version: "visual-understanding-v2",
    visual_analyzed_at: new Date().toISOString(),
    visual_analysis_json: {
      frame_or_image_count: 3,
      scene_summary: "冒頭は引きの構図で、後半は上半身寄りに切り替わる",
      subject_summary: "人物中心の短い動画",
      composition: "引きの構図から近いフレーミングへ変わる",
      camera_distance_or_framing: "引きから近め",
      visible_change_or_contrast: "途中で距離感が近くなる",
      motion_cue: "冒頭から中盤で画角が変わる",
      beginning_vs_later_change: "最初は引き、途中で距離が近い",
      standout_moment: "途中で距離感が近くなる",
      concrete_observation: "引きの構図から距離感が近くなる",
      confidence: "high",
      evidence_source: "x_public_video_frames:beginning/middle/end",
    },
  }, {
    id: 2,
    approved_media_id: 1,
    creator_id: 2,
    product_id: 2,
    creator_x_url: "https://x.com/creator2",
    source_x_handle: "creator2",
    x_post_url: "https://x.com/creator2/status/2",
    media_permalink: "https://x.com/creator2/status/2/video/1",
    media_type: "video",
    media_count: 1,
    quote_visual_ready: true,
    media_permalink_verified_at: new Date().toISOString(),
    media_permalink_validation_status: "verified_video_permalink",
    visual_render_status: "browser_visible",
    visual_score: 90,
    posted_at: new Date().toISOString(),
    text_excerpt: "階段から表情の近い場面へ変わる投稿",
    views: 2_990_000,
    likes: 32_000,
    reposts: 820,
    replies: 210,
    bookmarks: 0,
    has_image: false,
    has_video: true,
    is_pinned: false,
    is_reply: false,
    is_repost: false,
    is_quote: false,
    score: 96,
    score_reason: "viral visual",
    selected: false,
    creator_rank: 1,
    selected_for_today: false,
    last_used_at: null,
    collected_at: new Date().toISOString(),
    visual_analysis_status: "verified",
    visual_analyzer_version: "visual-understanding-v2",
    visual_analyzed_at: new Date().toISOString(),
    visual_analysis_json: {
      frame_or_image_count: 3,
      scene_summary: "階段の引きから表情の近い場面へ変わる",
      subject_summary: "人物中心の短い動画",
      composition: "引きから近いフレーミングへ変わる",
      camera_distance_or_framing: "階段の引きから近め",
      visible_change_or_contrast: "階段から表情の近い場面に変わる",
      motion_cue: "場面が切り替わる",
      beginning_vs_later_change: "最初は階段、途中で表情が近い",
      standout_moment: "表情の近い場面へ変わる",
      concrete_observation: "階段から表情の近い場面へ変わる",
      confidence: "high",
      evidence_source: "x_public_video_frames:beginning/middle/end",
    },
  }, {
    id: 3,
    approved_media_id: 1,
    creator_id: 3,
    product_id: 3,
    creator_x_url: "https://x.com/creator3",
    source_x_handle: "creator3",
    x_post_url: "https://x.com/creator3/status/3",
    media_permalink: "https://x.com/creator3/status/3/video/1",
    media_type: "video",
    media_count: 1,
    quote_visual_ready: true,
    media_permalink_verified_at: new Date().toISOString(),
    media_permalink_validation_status: "verified_video_permalink",
    visual_render_status: "browser_visible",
    visual_score: 90,
    posted_at: new Date().toISOString(),
    text_excerpt: "制服の一枚から距離の近い動画に切り替わる",
    views: 2_970_000,
    likes: 31_000,
    reposts: 790,
    replies: 200,
    bookmarks: 0,
    has_image: false,
    has_video: true,
    is_pinned: false,
    is_reply: false,
    is_repost: false,
    is_quote: false,
    score: 95,
    score_reason: "same metric bait",
    selected: false,
    creator_rank: 1,
    selected_for_today: false,
    last_used_at: null,
    collected_at: new Date().toISOString(),
    visual_analysis_status: "verified",
    visual_analyzer_version: "visual-understanding-v2",
    visual_analyzed_at: new Date().toISOString(),
    visual_analysis_json: {
      frame_or_image_count: 3,
      scene_summary: "制服の一枚から距離の近い動画に切り替わる",
      subject_summary: "人物中心の短い動画",
      composition: "一枚目から動画へ切り替わる",
      camera_distance_or_framing: "距離が近い",
      visible_change_or_contrast: "制服の一枚から距離の近い動画に変わる",
      motion_cue: "静止画から動画へ変わる",
      beginning_vs_later_change: "最初は制服の一枚、途中で距離が近い",
      standout_moment: "距離の近い動画に切り替わる",
      concrete_observation: "制服の一枚から距離の近い動画に切り替わる",
      confidence: "high",
      evidence_source: "x_public_video_frames:beginning/middle/end",
    },
  }],
  quoteCandidateSource: { dbCount: 0, loadedCount: 0, loadedAll: true, latestCollectedAt: null, pageSize: 500 },
};

const board = buildMyfansExecutionBoard(analytics as never, { planDate: "2026-09-09", operationDay: 1 });
assert.equal(board.recovery.targetPosts, 4);
assert.ok(board.recovery.attemptedCandidates >= 4);
assert.ok(board.recovery.history.every((row) => row.score >= 0 && row.score <= 100));
assert.ok(board.candidates.every((candidate) => candidate.quality.total >= MYFANS_QUALITY_GATE_MINIMUM));
assert.ok(board.candidates.length >= 1);
assert.ok(board.candidates.some((candidate) => candidate.dailyRole === "DISCOVERY" || candidate.dailyRole === "AUTHORITY"));
assert.ok(Math.max(...["ATTENTION", "DISCOVERY", "AUTHORITY", "REVENUE"].map((role) => board.candidates.filter((candidate) => candidate.dailyRole === role).length)) <= 2);
assert.ok(board.recovery.history.some((row) => row.initialRole !== row.recoveryRole || row.recoveryAction.includes("role swap")));
assert.ok(board.candidates.every((candidate) => !detectPublicCopyLeak(candidate.body).hasLeak));
assert.ok(board.candidates.every((candidate) => !/表示[0-9,]+\s*\/\s*いいね/.test(candidate.body)));
assert.ok(board.candidates.every((candidate) => !/^¥[0-9,]+/.test(candidate.body)));
assert.ok(board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => candidate.reactionType && candidate.visualUnderstanding));
assert.ok(board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => candidate.visualUnderstanding?.concreteVisualCue));
assert.ok(board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => candidate.visualUnderstanding?.humanObservation));
assert.ok(board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => !/(構図から距離感が近くなる|visual cue)/.test(candidate.body)));
assert.ok(board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => candidate.visualUnderstanding?.visualAnalysisStatus === "verified"));
assert.ok(board.candidates.every((candidate) => candidate.topicValue?.verdict === "PASS"));
assert.ok(board.candidates.every((candidate) => candidate.topicValue?.reasonToCare));
assert.ok(board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => candidate.generatorVersion === "public-copy-v12-topic-value"));
assert.ok(board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => !/(そりゃ伸びるよな|これ流れてきたら一回止まる|あとで見返したくなる入口|刺さるポイントが一瞬で伝わる)/.test(candidate.body)));
assert.ok(board.candidates.filter((candidate) => candidate.dailyRole === "DISCOVERY").every((candidate) => !/(比較して見る|反応と価格を見て残す|分析|判断材料)/.test(candidate.body)));
assert.ok(board.candidates.filter((candidate) => candidate.dailyRole === "AUTHORITY").every((candidate) => !/(探す手間を減らします|プロフィールにまとめます)$/.test(candidate.body.trim())));
assert.ok(board.candidates.filter((candidate) => candidate.dailyRole === "REVENUE").every((candidate) => candidate.selfReply.includes("https://mfco.link/r/")));

const oldRejectedBodies = [
  "室内の縦動画とくま要素から入るの強い。\n\n白っぽい室内で踊りの入りが見えるから続きが気になる。",
  "砂浜の赤と黒のボトムスだけで空気がだいぶ伝わる。\n\n絵文字だけの投稿から夏の全身構図が出るから先を見たくなる。",
  "体型の分かりやすさなら、そりゃ見ちゃう。\n\n体型の分かりやすさで先に引けてる。",
  "白いベッドで向かい合う構図だけで空気がだいぶ伝わる。\n\n手前の人物越しに距離感が出るから先を見たくなる。",
  "白いベッドで向かい合う構図。\n\n白いベッドで向かい合う構図。",
  "くま要素、縦動画、白い室内。\n\nvisual cueが分かりやすい。",
  "階段の写真から白いプロフィール画面に切り替わるのが目に残る。\n\nこういう入り方だと、説明が少なくても手が止まる。",
  "白っぽい部屋で動き出すところが先に目に入る、地味に強い。\n\n最初から全部説明しない感じが逆に気になる。",
];

for (const body of oldRejectedBodies) {
  const quality = evaluateMyfansPublicCopyQuality({
    body,
    product: product as never,
    postType: "discovery_interest",
    linkStrategy: "no_link",
    creativeStrategy: "quote_post",
    quote: analytics.quoteCandidates[0] as never,
  });
  assert.equal(quality.verdict, "HOLD", body);
  assert.ok(quality.total < MYFANS_QUALITY_GATE_MINIMUM, body);
}

for (const body of hardFailBodies) {
  const quality = evaluateMyfansPublicCopyQuality({
    body,
    product: product as never,
    postType: "ranking_note",
    linkStrategy: "no_link",
    creativeStrategy: "discovery_card",
    quote: null,
  });
  assert.equal(quality.verdict, "HOLD", body);
}

const topicIdentities = board.candidates.map((candidate) => candidate.topicIdentity);
assert.equal(topicIdentities.length, new Set(topicIdentities).size);
assert.ok(board.candidates.every((candidate) => !/myfansアフィリエイト|X側で|単独の条件より/.test(candidate.body)));
assert.ok(board.candidates.filter((candidate) => candidate.dailyRole === "AUTHORITY").every((candidate) => candidate.topicIdentity.startsWith("aggregate:")));
assert.ok(board.recovery.history.some((row) => /topic_identity|source metric\/event|AUTHORITYは単一source/.test(row.qualityReasons.join(" "))));
assert.ok(board.candidates.filter((candidate) => candidate.topicIdentity.startsWith("aggregate:")).every((candidate) => candidate.topicIdentity.split("|").length >= 2));

const fallbackAnalytics = {
  ...analytics,
  quoteCandidates: [{
    ...analytics.quoteCandidates[0],
    id: 2,
    visual_analysis_status: "unavailable",
    visual_analysis_json: {},
    visual_analyzed_at: null,
    visual_analyzer_version: null,
    text_excerpt: "冒頭から雰囲気が変わる投稿",
  }],
};
const fallbackBoard = buildMyfansExecutionBoard(fallbackAnalytics as never, { planDate: "2026-09-09", operationDay: 1 });
assert.ok(fallbackBoard.candidates.every((candidate) => candidate.creativeStrategy !== "quote_post" || candidate.visualUnderstanding?.visualAnalysisStatus === "verified"));
assert.ok(fallbackBoard.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").every((candidate) => !/(引きの構図から距離感が近くなる|途中で距離感が近くなる)/.test(candidate.body)));
assert.ok(fallbackBoard.candidates.some((candidate) => candidate.dailyRole === "DISCOVERY" || candidate.dailyRole === "AUTHORITY"));
assert.ok(Math.max(...["ATTENTION", "DISCOVERY", "AUTHORITY", "REVENUE"].map((role) => fallbackBoard.candidates.filter((candidate) => candidate.dailyRole === role).length)) <= 2);

const topicBaselines = {
  creatorMedianLikes: new Map([["creator:1", 100], ["creator:2", 40]]),
  creatorMedianSaves: new Map([["creator:1", 20], ["creator:2", 5]]),
  priceBucketMedianLikes: new Map([["low", 90], ["mid", 120], ["high", 150]]),
  genreMedianLikes: new Map([["sample", 100]]),
  allLikes: [20, 40, 80, 100, 120, 260, 520],
  allQuoteViews: [1000, 5000, 10000, 50000, 120000],
  allQuoteLikes: [10, 30, 100, 1200, 5000],
};

const priceOnlyTopic = evaluateMyfansTopicValue({
  product: { ...product, id: 20, price: 1500, likes_count: 0, saves_count: 0, popularity_rank: null, is_new: false } as never,
  quote: null,
  role: "DISCOVERY",
  baselines: topicBaselines as never,
});
assert.equal(priceOnlyTopic.verdict, "LOW_TOPIC_VALUE");
assert.ok(priceOnlyTopic.whyRejected.some((reason) => /価格単独|reason_to_care/.test(reason)));

const metricsOnlyTopic = evaluateMyfansTopicValue({
  product: { ...product, id: 21, price: 3980, likes_count: 60, saves_count: 0, popularity_rank: 12, is_new: false, creator_id: 2 } as never,
  quote: null,
  role: "DISCOVERY",
  baselines: topicBaselines as never,
});
assert.equal(metricsOnlyTopic.verdict, "LOW_TOPIC_VALUE");

const creatorOutlierTopic = evaluateMyfansTopicValue({
  product: { ...product, id: 22, price: 980, likes_count: 520, saves_count: 80, popularity_rank: 4, is_new: true } as never,
  quote: null,
  role: "DISCOVERY",
  baselines: topicBaselines as never,
});
assert.equal(creatorOutlierTopic.verdict, "PASS");
assert.equal(creatorOutlierTopic.reasonToCare, "creator_outlier");

const visualGapTopic = evaluateMyfansTopicValue({
  product: product as never,
  quote: analytics.quoteCandidates[0] as never,
  role: "ATTENTION",
  baselines: topicBaselines as never,
});
assert.equal(visualGapTopic.verdict, "PASS");
assert.ok(visualGapTopic.reasonToCare);
assert.ok(visualGapTopic.evidence.some((item) => item.includes("verified visual")));

assert.equal(isValidMyfansAffiliateUrl("https://mfco.link/r/example_123"), true);
assert.equal(isValidMyfansAffiliateUrl("https://example.com/r/example_123"), false);
assert.equal(normalizeMyfansAffiliateUrl(" https://mfco.link/r/example_123 "), "https://mfco.link/r/example_123");
assert.equal(myfansAffiliateLinkStatus({ affiliate_url: "", affiliate_url_expires_at: null }), "missing");
assert.equal(myfansAffiliateLinkStatus({ affiliate_url: "https://mfco.link/r/example_123", affiliate_url_expires_at: "2026-09-12T00:00:00.000Z" }, new Date("2026-09-11T10:00:00.000Z")), "expiring_soon");
assert.equal(myfansAffiliateLinkStatus({ affiliate_url: "https://mfco.link/r/example_123", affiliate_url_expires_at: "2026-09-10T00:00:00.000Z" }, new Date("2026-09-11T10:00:00.000Z")), "expired");
assert.equal(myfansAffiliateLinkStatus({ affiliate_url: "https://mfco.link/r/example_123", affiliate_url_expires_at: null }, new Date("2026-09-11T10:00:00.000Z")), "valid");

const concreteVisualCandidate = {
  ...analytics.quoteCandidates[0],
  id: 101,
  creator_id: 101,
  source_x_handle: "visual101",
  x_post_url: "https://x.com/visual101/status/101",
  media_permalink: "https://x.com/visual101/status/101/video/1",
  media_type: "video",
  media_permalink_validation_status: "verified_video_permalink",
  quote_visual_ready: true,
  text_excerpt: "冒頭の引きから途中で表情の近い場面に切り替わる",
  visual_analysis_status: "unavailable",
};
const concreteVisual = analyzeMyfansQuoteVisual(concreteVisualCandidate as never);
assert.equal(concreteVisual.status, "verified");
assert.equal(concreteVisual.visualRenderStatus, "browser_visible");
assert.ok(concreteVisual.analysis.concrete_scene);
assert.ok(concreteVisual.analysis.subject_action);
assert.ok(concreteVisual.analysis.standout_moment);
assert.ok(concreteVisual.analysis.contrast_change);
assert.ok(concreteVisual.analysis.color_composition);
assert.ok(concreteVisual.analysis.human_curiosity_cue);
assert.ok(concreteVisual.analysis.confidence);
assert.ok(concreteVisual.analysis.evidence_source);

const weakVisual = analyzeMyfansQuoteVisual({
  ...concreteVisualCandidate,
  id: 102,
  text_excerpt: "白い背景のプロフィール画面が目に入る",
} as never);
assert.notEqual(weakVisual.status, "verified");

const selectedVisualBatch = selectVisualVerificationBatch([
  concreteVisualCandidate,
  { ...concreteVisualCandidate, id: 103, creator_id: 101, views: 900_000, likes: 10_000, text_excerpt: "最初の階段から近い表情へ切り替わる" },
  { ...concreteVisualCandidate, id: 104, creator_id: 102, views: 800_000, likes: 9000, text_excerpt: "海の明るさに赤と黒が浮いて見える" },
  { ...concreteVisualCandidate, id: 105, creator_id: 103, media_type: "image", media_permalink: "https://x.com/visual103/status/105/photo/1", media_permalink_validation_status: "", views: 700_000, likes: 8000, text_excerpt: "一枚目の制服写真から距離の近さが残る" },
] as never, 3);
assert.equal(selectedVisualBatch.length, 3);
assert.ok(new Set(selectedVisualBatch.map((candidate) => candidate.creator_id)).size >= 2);

console.log("myfans public copy leak tests passed");
