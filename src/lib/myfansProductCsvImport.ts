import { calculateMyfansSelectionScore, myfansLaunchPriority } from "./myfansScore";

export type MyfansProductCsvRow = Record<string, string | undefined>;

type ProductImportMetrics = {
  price: number;
  reward_rate: number;
  estimated_reward: number;
  plan_signup_reward: number;
  recurring_reward_rate: number;
  popularity_rank: number | null;
  likes_count: number;
  saves_count: number;
  is_new: boolean;
  selection_score: number;
  launch_priority: string;
};

export function buildMyfansProductImportRecord(row: MyfansProductCsvRow, now: () => string = () => new Date().toISOString()) {
  const affiliateUrl = csvText(row, ["affiliate_url", "アフィリンク"]);
  const approvedMediaName = csvText(row, ["approved_media_name", "承認済みメディア"]);
  const metrics = productImportMetrics(row, affiliateUrl, approvedMediaName);
  return {
    title: csvText(row, ["title", "商品名"]),
    product_url: csvText(row, ["product_url", "商品URL"]),
    affiliate_url: affiliateUrl,
    ...affiliateImportFields(affiliateUrl, now),
    source_x_url: csvText(row, ["source_x_url", "引用元X URL"]),
    creator_x_url: csvText(row, ["creator_x_url", "creator X URL", "クリエイターX URL"]),
    quote_candidate_x_url: csvText(row, ["quote_candidate_x_url", "引用候補X URL", "source_x_url", "引用元X URL"]),
    media_permission_status: csvText(row, ["media_permission_status", "素材許諾"], "unknown") || "unknown",
    media_permission_note: csvText(row, ["media_permission_note", "素材許諾メモ"]),
    genre: csvText(row, ["genre", "ジャンル"]),
    product_type: csvText(row, ["product_type", "商品種別"], "single") || "single",
    status: csvText(row, ["status", "状態"], "candidate") || "candidate",
    ...metrics,
    selection_reason: csvText(row, ["selection_reason", "選定理由"]),
    notes: csvText(row, ["notes", "メモ"]),
    approved_media_name: approvedMediaName,
    approved_media_url: csvText(row, ["approved_media_url", "承認メディアURL"]),
    affiliate_media_id: csvText(row, ["affiliate_media_id", "メディアID"]),
    last_reviewed_at: now(),
    updated_at: now(),
  };
}

function csvValue(row: MyfansProductCsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function csvText(row: MyfansProductCsvRow, keys: string[], fallback = "") {
  return String(csvValue(row, keys) ?? fallback);
}

function csvNumber(row: MyfansProductCsvRow, keys: string[]) {
  return Number(csvValue(row, keys) ?? 0) || 0;
}

function csvPopularityRank(row: MyfansProductCsvRow) {
  const hasRank = Boolean(row.popularity_rank || row["人気順位"]);
  return hasRank ? Number(csvValue(row, ["popularity_rank", "人気順位"])) : null;
}

function csvIsNew(row: MyfansProductCsvRow) {
  return csvText(row, ["is_new", "新着"]) === "true" || row["新着"] === "はい";
}

function productImportMetrics(row: MyfansProductCsvRow, affiliateUrl: string, approvedMediaName: string): ProductImportMetrics {
  const price = csvNumber(row, ["price", "価格"]);
  const rewardRate = csvNumber(row, ["reward_rate", "報酬率"]);
  const planSignupReward = csvNumber(row, ["plan_signup_reward", "プラン加入報酬"]);
  const recurringRewardRate = csvNumber(row, ["recurring_reward_rate", "継続報酬率"]);
  const popularityRank = csvPopularityRank(row);
  const likesCount = csvNumber(row, ["likes_count", "いいね"]);
  const savesCount = csvNumber(row, ["saves_count", "保存"]);
  const isNew = csvIsNew(row);
  const selectionScore = calculateMyfansSelectionScore({
    price,
    rewardRate,
    planSignupReward,
    recurringRewardRate,
    popularityRank,
    likesCount,
    savesCount,
    isNew,
    hasAffiliateUrl: Boolean(affiliateUrl),
    hasApprovedMedia: Boolean(approvedMediaName || row.affiliate_media_id),
    source_x_url: csvText(row, ["source_x_url", "引用元X URL"]),
  });
  return {
    price,
    reward_rate: rewardRate,
    estimated_reward: Math.round(price * (rewardRate / 100)),
    plan_signup_reward: planSignupReward,
    recurring_reward_rate: recurringRewardRate,
    popularity_rank: popularityRank,
    likes_count: likesCount,
    saves_count: savesCount,
    is_new: isNew,
    selection_score: selectionScore,
    launch_priority: myfansLaunchPriority(selectionScore),
  };
}

function affiliateImportFields(affiliateUrl: string, now: () => string) {
  if (!affiliateUrl) return {};
  return {
    affiliate_url_generated_at: now(),
    affiliate_url_expires_at: null,
    affiliate_url_source: "csv_import",
  };
}
