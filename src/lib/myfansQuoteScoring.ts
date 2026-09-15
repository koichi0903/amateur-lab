export type MyfansQuoteScanCandidate = {
  xPostUrl: string;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 86_400_000);
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

export function scoreMyfansQuoteCandidate(candidate: MyfansQuoteScanCandidate): MyfansQuoteScore {
  const reasons: string[] = [];
  let score = 0;
  const ageDays = daysSince(candidate.postedAt);

  if (!candidate.xPostUrl || !/https:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+/.test(candidate.xPostUrl)) {
    return { score: 0, eligible: false, reason: "status URLを取得できませんでした。" };
  }
  if (candidate.isRepost) return { score: 0, eligible: false, reason: "creator本人のオリジナル投稿ではないため除外。" };
  if (candidate.isReply) {
    score -= 20;
    reasons.push("返信投稿のため減点");
  }

  if ((candidate.views ?? 0) > 0) {
    const value = clamp(Math.log10((candidate.views ?? 0) + 1) * 14, 0, 42);
    score += value;
    reasons.push(`表示${candidate.views}件`);
  }

  const engagement = engagementScore(candidate);
  score += engagement;
  if (engagement > 0) reasons.push(`反応: 返信${candidate.replies ?? 0}/RP${candidate.reposts ?? 0}/いいね${candidate.likes ?? 0}`);

  if (ageDays !== null) {
    const freshness = ageDays <= 3 ? 18 : ageDays <= 14 ? 14 : ageDays <= 45 ? 8 : 2;
    score += freshness;
    reasons.push(ageDays <= 14 ? "新しい投稿" : "古い投稿");
  }

  const visual = visualPriority(candidate);
  if (visual === 3) {
    score += 18;
    reasons.push("動画media permalink取得済み");
  } else if (visual === 2) {
    score += 14;
    reasons.push("画像media permalink取得済み");
  } else if (visual === 1) {
    score -= 10;
    reasons.push("mediaありだが引用表示未確認");
  }
  if (candidate.isQuote) {
    score -= 8;
    reasons.push("引用投稿のため減点");
  }
  if (candidate.isPinned) {
    score += ageDays !== null && ageDays > 45 ? 1 : 5;
    reasons.push("固定投稿");
  }

  const rounded = Math.round(clamp(score, 0, 100));
  const eligible = rounded >= 35 && !candidate.isRepost;
  return {
    score: rounded,
    eligible,
    reason: eligible ? reasons.join(" / ") : `候補不足: ${reasons.join(" / ") || "客観指標が少ない"}`,
  };
}
