export type CandidateSaveInput = {
  id: string;
  body: string;
  sourceXUrl?: string | null;
  quoteXUrl?: string | null;
};

/**
 * Saving a candidate log is separate from making a candidate publish-ready.
 * In particular, a missing affiliate URL is not a save blocker: the log must
 * preserve the candidate and its attribution before link preparation happens.
 */
export function candidateSaveBlockReason(candidate: CandidateSaveInput): string | null {
  if (!candidate.id.trim()) return "候補IDがありません。候補を再読み込みしてください。";
  if (!candidate.body.trim()) return "投稿本文がありません。候補を再評価してください。";
  if (!(candidate.quoteXUrl?.trim() || candidate.sourceXUrl?.trim())) return "引用元X URLがありません。候補を再取得してください。";
  return null;
}
