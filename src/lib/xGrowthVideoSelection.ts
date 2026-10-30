export const X_GROWTH_VIDEO_SELECTION_LIMIT = 5;

export type RankedVideoCandidate = {
  workId: number;
  title: string;
  sampleUrlOfficial: boolean;
  hardGatePassed: boolean;
  firstDropReason: string | null;
  rankingScore: number;
  freshnessScore: number;
  discountRate: number;
  saleEndAt: string | null;
  creativeQualityScore: number;
  lastPostedAt: string | null;
  rankScore: number;
  rankReasons: string[];
};

export type VideoCandidateSignals = Omit<RankedVideoCandidate, "lastPostedAt" | "rankScore" | "rankReasons">;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

function saleUrgency(saleEndAt: string | null, now: number) {
  if (!saleEndAt) return 0;
  const end = Date.parse(saleEndAt);
  if (!Number.isFinite(end) || end <= now) return 0;
  const hours = (end - now) / 3_600_000;
  if (hours <= 24) return 100;
  if (hours <= 72) return 75;
  if (hours <= 120) return 45;
  return 20;
}

function postingHistoryPenalty(daysSincePost: number) {
  if (daysSincePost < 3) return 45;
  if (daysSincePost < 7) return 30;
  if (daysSincePost < 30) return 12;
  return 0;
}

function saleRankReason(urgency: number, discount: number) {
  if (urgency > 0) {
    if (urgency <= 45) return "セール期限 5日以内";
    if (urgency <= 75) return "セール期限 3日以内";
    return "セール期限 24時間以内";
  }
  return discount > 0 ? `割引率 ${Math.round(discount)}%` : "強いセール根拠なし";
}

function postingRankReason(daysSincePost: number) {
  return Number.isFinite(daysSincePost) && daysSincePost < 30
    ? `直近投稿から約${Math.max(0, Math.floor(daysSincePost))}日`
    : "直近30日の投稿重複なし";
}

function rankVideoCandidate(
  candidate: VideoCandidateSignals,
  lastPostedAtByWorkId: ReadonlyMap<number, string>,
  nowMs: number,
): RankedVideoCandidate {
  const lastPostedAt = lastPostedAtByWorkId.get(candidate.workId) ?? null;
  const lastPostTime = lastPostedAt ? Date.parse(lastPostedAt) : Number.NaN;
  const daysSincePost = Number.isFinite(lastPostTime) ? (nowMs - lastPostTime) / 86_400_000 : Number.POSITIVE_INFINITY;
  const historyPenalty = postingHistoryPenalty(daysSincePost);
  const urgency = saleUrgency(candidate.saleEndAt, nowMs);
  const discount = clamp(candidate.discountRate);
  const saleSignal = Math.max(urgency, discount * 0.8);
  const rankScore = Math.round(clamp(
    clamp(candidate.rankingScore) * 0.38
    + clamp(candidate.freshnessScore) * 0.28
    + clamp(candidate.creativeQualityScore) * 0.20
    + saleSignal * 0.14
    - historyPenalty,
  ) * 100) / 100;
  const rankReasons = [
    `作品スコア ${Math.round(clamp(candidate.rankingScore))}`,
    `鮮度 ${Math.round(clamp(candidate.freshnessScore))}`,
    saleRankReason(urgency, discount),
    postingRankReason(daysSincePost),
    `動画品質 ${Math.round(clamp(candidate.creativeQualityScore))}`,
  ];
  return { ...candidate, lastPostedAt, rankScore, rankReasons };
}

export function rankXGrowthVideoCandidates(
  candidates: readonly VideoCandidateSignals[],
  lastPostedAtByWorkId: ReadonlyMap<number, string> = new Map(),
  now = new Date(),
): RankedVideoCandidate[] {
  const nowMs = now.getTime();
  const unique = new Map<number, VideoCandidateSignals>();
  for (const candidate of candidates) {
    if (!candidate.hardGatePassed || !Number.isSafeInteger(candidate.workId) || candidate.workId <= 0) continue;
    const current = unique.get(candidate.workId);
    if (!current || candidate.rankingScore > current.rankingScore) unique.set(candidate.workId, candidate);
  }

  return [...unique.values()]
    .map((candidate) => rankVideoCandidate(candidate, lastPostedAtByWorkId, nowMs))
    .sort((a, b) => b.rankScore - a.rankScore || a.workId - b.workId);
}

export function chooseXGrowthVideoCandidates(
  ranked: readonly RankedVideoCandidate[],
  manualOverrideWorkIds: readonly number[] = [],
  excludedWorkIds: readonly number[] = [],
) {
  const byId = new Map(ranked.map((candidate) => [candidate.workId, candidate]));
  const excluded = new Set(excludedWorkIds);
  const selected: RankedVideoCandidate[] = [];
  const seen = new Set<number>();
  for (const workId of manualOverrideWorkIds) {
    const candidate = byId.get(workId);
    if (!candidate || seen.has(workId) || selected.length >= X_GROWTH_VIDEO_SELECTION_LIMIT) continue;
    selected.push(candidate);
    seen.add(workId);
  }
  for (const candidate of ranked) {
    if (selected.length >= X_GROWTH_VIDEO_SELECTION_LIMIT) break;
    if (seen.has(candidate.workId) || excluded.has(candidate.workId)) continue;
    selected.push(candidate);
    seen.add(candidate.workId);
  }
  return selected;
}
