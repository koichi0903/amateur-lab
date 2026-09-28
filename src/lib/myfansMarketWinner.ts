export type MarketWinnerCandidate = {
  sourceXUrl: string;
  body: string;
  productId?: number | null;
  creatorId?: number | null;
  quoteCandidateId?: number | null;
  sourceStrength: number;
  productOpportunity: number;
  creatorStrength: number;
  patternFit: number;
  learningWeight?: number;
  globalContentFingerprint: string;
};

export type MarketPatternKey =
  | "QUOTE_HOOK"
  | "PRICE_DROP"
  | "LIMITED_WINDOW"
  | "CREATOR_DISCOVERY"
  | "COMPARISON"
  | "NEW_RELEASE"
  | "SOCIAL_PROOF"
  | "CURIOSITY_GAP"
  | "FOLLOW_SERIES";

export type WinnerScoreComponents = {
  patternFit: number;
  sourceStrength: number;
  productOpportunity: number;
  creatorStrength: number;
  learningWeight: number;
  guardPenalty: number;
};

export type CrossAccountGuard = {
  sourceXUrl?: string | null;
  productId?: number | null;
  creatorId?: number | null;
  globalContentFingerprint?: string | null;
  lastSeenAt?: string | null;
  cooldownUntil?: string | null;
};

export type GuardDecision = { blocked: boolean; penalty: number; reasons: string[] };

export function evaluateCrossAccountGuard(candidate: MarketWinnerCandidate, guards: CrossAccountGuard[], now = new Date()): GuardDecision {
  const reasons: string[] = [];
  let penalty = 0;
  for (const guard of guards) {
    if (guard.globalContentFingerprint && guard.globalContentFingerprint === candidate.globalContentFingerprint) reasons.push("same_body_fingerprint");
    if (guard.sourceXUrl && guard.sourceXUrl.toLowerCase() === candidate.sourceXUrl.toLowerCase()) reasons.push("same_source");
    if (guard.productId && candidate.productId && guard.productId === candidate.productId) {
      const cooldown = guard.cooldownUntil ? new Date(guard.cooldownUntil).getTime() : 0;
      if (cooldown > now.getTime()) reasons.push("product_cooldown");
      else penalty = Math.max(penalty, 12);
    }
    if (guard.creatorId && candidate.creatorId && guard.creatorId === candidate.creatorId) penalty = Math.max(penalty, 8);
  }
  const hardReasons = reasons.filter((reason) => reason === "same_body_fingerprint" || reason === "same_source" || reason === "product_cooldown");
  return { blocked: hardReasons.length > 0, penalty, reasons: [...new Set(reasons)] };
}

export function calculateWinnerScore(candidate: MarketWinnerCandidate, guard: GuardDecision) {
  const learning = candidate.learningWeight ?? 1;
  const raw = candidate.patternFit * 0.3 + candidate.sourceStrength * 0.25 + candidate.productOpportunity * 0.2 + candidate.creatorStrength * 0.15 + learning * 10 - guard.penalty;
  return Math.max(0, Math.min(100, Number(raw.toFixed(4))));
}

export function winnerScoreComponents(candidate: MarketWinnerCandidate, guard: GuardDecision): WinnerScoreComponents {
  return {
    patternFit: candidate.patternFit,
    sourceStrength: candidate.sourceStrength,
    productOpportunity: candidate.productOpportunity,
    creatorStrength: candidate.creatorStrength,
    learningWeight: candidate.learningWeight ?? 1,
    guardPenalty: guard.penalty,
  };
}

export function rankMarketWinnerCandidates(candidates: MarketWinnerCandidate[], guards: CrossAccountGuard[], now = new Date()) {
  return candidates
    .map((candidate) => {
      const guard = evaluateCrossAccountGuard(candidate, guards, now);
      return { candidate, guard, winnerScore: calculateWinnerScore(candidate, guard) };
    })
    .filter((item) => !item.guard.blocked)
    .sort((a, b) => b.winnerScore - a.winnerScore);
}
