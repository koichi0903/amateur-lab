import { daysSinceIso } from "@/lib/myfans/myfansTime";

export type MyfansQuoteScanCandidate = {
  xPostUrl: string;
  parentStatusUrl?: string | null;
  parentStatusId?: string | null;
  ownReplyStatusUrl?: string | null;
  ownReplyStatusId?: string | null;
  myfansLinkSource?: "parent" | "own_reply" | null;
  threadCollectionStatus?: string | null;
  collectorMethod?: string | null;
  resolvedProductEvidence?: Record<string, unknown> | null;
  mediaPermalink?: string | null;
  verifiedVideoPermalink?: string | null;
  generatedVideoPermalink?: string | null;
  validationStatus?: string | null;
  mediaType?: "image" | "video" | "none" | null;
  mediaCount?: number | null;
  quoteVisualReady?: boolean | null;
  sourceXHandle: string;
  postedAt?: string | null;
  text?: string | null;
  articleText?: string | null;
  myfansUrls?: string[];
  views?: number | null;
  likes?: number | null;
  reposts?: number | null;
  replies?: number | null;
  bookmarks?: number | null;
  hasImage?: boolean;
  hasVideo?: boolean;
  isPinned?: boolean;
  isReply?: boolean;
  isRepost?: boolean;
  isQuote?: boolean;
};

export type MyfansQuoteScore = {
  score: number;
  eligible: boolean;
  reason: string;
};

type ScoreContribution = { score: number; reasons: string[] };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function engagementScore(candidate: MyfansQuoteScanCandidate) {
  const views = candidate.views ?? 0;
  const likes = candidate.likes ?? 0;
  const reposts = candidate.reposts ?? 0;
  const replies = candidate.replies ?? 0;
  if (views > 0) return clamp(((likes * 3 + reposts * 5 + replies * 2) / views) * 400, 0, 35);
  return clamp(likes * 4 + reposts * 7 + replies * 3, 0, 35);
}

function visualPriority(candidate: MyfansQuoteScanCandidate) {
  if (candidate.quoteVisualReady && candidate.mediaPermalink && candidate.mediaType === "video" && candidate.validationStatus === "verified_video_permalink") return 3;
  if (candidate.quoteVisualReady && candidate.mediaPermalink && candidate.mediaType === "image") return 2;
  if (candidate.hasVideo || candidate.hasImage) return 1;
  return 0;
}

function replyContribution(candidate: MyfansQuoteScanCandidate): ScoreContribution {
  return candidate.isReply ? { score: -20, reasons: ["返信投稿のため減点"] } : { score: 0, reasons: [] };
}

function viewsContribution(candidate: MyfansQuoteScanCandidate): ScoreContribution {
  if ((candidate.views ?? 0) <= 0) return { score: 0, reasons: [] };
  const views = candidate.views ?? 0;
  return {
    score: clamp(Math.log10(views + 1) * 14, 0, 42),
    reasons: [`表示${views}件`],
  };
}

function engagementContribution(candidate: MyfansQuoteScanCandidate): ScoreContribution {
  const score = engagementScore(candidate);
  return {
    score,
    reasons: score > 0 ? [`反応: 返信${candidate.replies ?? 0}/RP${candidate.reposts ?? 0}/いいね${candidate.likes ?? 0}`] : [],
  };
}

function freshnessContribution(ageDays: number | null): ScoreContribution {
  if (ageDays === null) return { score: 0, reasons: [] };
  const score = ageDays <= 3 ? 18 : ageDays <= 14 ? 14 : ageDays <= 45 ? 8 : 2;
  return { score, reasons: [ageDays <= 14 ? "新しい投稿" : "古い投稿"] };
}

function visualContribution(candidate: MyfansQuoteScanCandidate): ScoreContribution {
  const visual = visualPriority(candidate);
  if (visual === 3) return { score: 18, reasons: ["動画media permalink取得済み"] };
  if (visual === 2) return { score: 14, reasons: ["画像media permalink取得済み"] };
  if (visual === 1) return { score: -10, reasons: ["mediaありだが引用表示未確認"] };
  return { score: 0, reasons: [] };
}

function postFlagContribution(candidate: MyfansQuoteScanCandidate, ageDays: number | null): ScoreContribution {
  const reasons: string[] = [];
  let score = 0;
  if (candidate.isQuote) {
    score -= 8;
    reasons.push("引用投稿のため減点");
  }
  if (candidate.isPinned) {
    score += ageDays !== null && ageDays > 45 ? 1 : 5;
    reasons.push("固定投稿");
  }
  return { score, reasons };
}

function scoreContributions(candidate: MyfansQuoteScanCandidate, ageDays: number | null): ScoreContribution[] {
  return [
    replyContribution(candidate),
    viewsContribution(candidate),
    engagementContribution(candidate),
    freshnessContribution(ageDays),
    visualContribution(candidate),
    postFlagContribution(candidate, ageDays),
  ];
}

export function scoreMyfansQuoteCandidate(candidate: MyfansQuoteScanCandidate): MyfansQuoteScore {
  const ageDays = daysSinceIso(candidate.postedAt);

  if (!candidate.xPostUrl || !/https:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+/.test(candidate.xPostUrl)) {
    return { score: 0, eligible: false, reason: "status URLを取得できませんでした。" };
  }
  if (candidate.isRepost) return { score: 0, eligible: false, reason: "creator本人のオリジナル投稿ではないため除外。" };
  const contributions = scoreContributions(candidate, ageDays);
  const reasons = contributions.flatMap((item) => item.reasons);
  const score = contributions.reduce((total, item) => total + item.score, 0);
  const rounded = Math.round(clamp(score, 0, 100));
  const eligible = rounded >= 35 && !candidate.isRepost;
  return {
    score: rounded,
    eligible,
    reason: eligible ? reasons.join(" / ") : `候補不足: ${reasons.join(" / ") || "客観指標が少ない"}`,
  };
}
