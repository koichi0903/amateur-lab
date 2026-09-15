import type { MyfansAnalytics, MyfansProduct } from "@/lib/myfansAnalytics";
import { calculateMyfansOpportunityScores } from "@/lib/myfansScore";

export type MyfansCandidatePool = "growth" | "revenue" | "ltv";

export type MyfansAcquisitionRoute = {
  id: string;
  label: string;
  url: string;
  confirmedSurface: string;
  availableInfo: string[];
  approximateItemsPerPage: number;
  pools: MyfansCandidatePool[];
  duplicateRisk: "低" | "中" | "高";
  humanAction: string;
  affiliateUrlAvailability: string;
  approvalImpact: string;
};

export type MyfansAcquisitionTask = {
  id: string;
  route: MyfansAcquisitionRoute;
  pool: MyfansCandidatePool;
  targetCount: number;
  currentCount: number;
  reason: string;
  instruction: string;
};

function isRegularMfcoAffiliateUrl(value: string | null | undefined) {
  return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+(?:[/?#].*)?$/.test((value ?? "").trim());
}

export const MYFANS_CONFIRMED_ACQUISITION_ROUTES: MyfansAcquisitionRoute[] = [
  {
    id: "post-genre-new-video",
    label: "投稿検索 ジャンル結果 新着順 動画",
    url: "https://www.affiliate.myfans.jp/affiliates/search/genres/f-large-breasts/result?sexual_orientation=woman&genre_name=%E5%B7%A8%E4%B9%B3",
    confirmedSurface: "投稿検索 > 一般アダルト > カテゴリ > 見た目 > 巨乳。結果画面で、すべて/動画/画像と人気順/報酬率が高い順/新着順/いいね順/保存順を確認。",
    availableInfo: ["投稿URL", "creator詳細URL", "投稿本文", "サムネイル", "動画時間", "価格", "単品報酬率", "推定報酬額", "投稿日", "プロフィールURLコピー", "投稿アフィURLコピー"],
    approximateItemsPerPage: 20,
    pools: ["growth"],
    duplicateRisk: "中",
    humanAction: "画面で新着順と動画を選び、Companionで一覧を登録する。",
    affiliateUrlAvailability: "投稿のアフィURLコピー導線あり。Companionはコピー後のURLまたは表示中情報を保存する。",
    approvalImpact: "一般検索ではcreatorにapproved/premium表示あり。承認済みcreator専用タブは現在空。",
  },
  {
    id: "post-genre-reward",
    label: "投稿検索 ジャンル結果 報酬率が高い順",
    url: "https://www.affiliate.myfans.jp/affiliates/search/genres/f-large-breasts/result?sexual_orientation=woman&genre_name=%E5%B7%A8%E4%B9%B3",
    confirmedSurface: "投稿検索のジャンル結果画面。ソートに報酬率が高い順を確認。",
    availableInfo: ["投稿URL", "creator詳細URL", "価格", "単品報酬率", "推定報酬額", "いいね/保存系の人気表示", "投稿アフィURLコピー"],
    approximateItemsPerPage: 20,
    pools: ["revenue"],
    duplicateRisk: "中",
    humanAction: "画面で報酬率が高い順を選び、投稿アフィURLをコピーしてからCompanionで登録する。",
    affiliateUrlAvailability: "投稿単位の正規アフィURLコピー導線あり。",
    approvalImpact: "creator承認がなくても投稿アフィURLコピーは表示される範囲がある。プロフィールURLは無効表示のcreatorもある。",
  },
  {
    id: "post-genre-popular",
    label: "投稿検索 ジャンル結果 人気/いいね/保存順",
    url: "https://www.affiliate.myfans.jp/affiliates/search/genres/f-large-breasts/result?sexual_orientation=woman&genre_name=%E5%B7%A8%E4%B9%B3",
    confirmedSurface: "投稿検索のジャンル結果画面。人気順、いいね順、保存順を確認。",
    availableInfo: ["投稿URL", "creator詳細URL", "投稿本文", "価格", "単品報酬率", "推定報酬額", "投稿アフィURLコピー"],
    approximateItemsPerPage: 20,
    pools: ["growth", "revenue"],
    duplicateRisk: "高",
    humanAction: "人気順/いいね順/保存順を切り替え、既に登録済みのcreatorに偏らないようCompanionで登録する。",
    affiliateUrlAvailability: "投稿単位の正規アフィURLコピー導線あり。",
    approvalImpact: "一覧上でプロフィールURLが無効のcreatorがあるため、Revenueは投稿URL優先で扱う。",
  },
  {
    id: "creator-single-reward",
    label: "クリエイター検索 一般 単品報酬単価順",
    url: "https://www.affiliate.myfans.jp/affiliates/search/creators",
    confirmedSurface: "クリエイター検索 > 一般。新規登録順、公開件数が多い順、単品報酬単価が高い順、プラン報酬単価が高い順、フォロワー数が多い順を確認。",
    availableInfo: ["creator詳細URL", "creator名", "approved/premium表示", "フォロワー数", "投稿数", "単品販売報酬率", "プラン加入報酬率", "SNSリンク"],
    approximateItemsPerPage: 20,
    pools: ["revenue", "ltv"],
    duplicateRisk: "中",
    humanAction: "単品報酬単価順のまま、未登録creatorをCompanionで登録する。",
    affiliateUrlAvailability: "creator一覧では商品アフィURLは取れない。詳細または投稿一覧で投稿アフィURLを生成する。",
    approvalImpact: "一般タブ内にapproved/premium表示あり。承認済みタブは現在空。",
  },
  {
    id: "creator-plan-reward",
    label: "クリエイター検索 一般 プラン報酬単価順",
    url: "https://www.affiliate.myfans.jp/affiliates/search/creators",
    confirmedSurface: "クリエイター検索のソートにプラン報酬単価が高い順を確認。",
    availableInfo: ["creator詳細URL", "フォロワー数", "投稿数", "単品報酬率", "プラン加入報酬率", "SNSリンク"],
    approximateItemsPerPage: 20,
    pools: ["ltv"],
    duplicateRisk: "中",
    humanAction: "プラン報酬単価順を選び、creator詳細を開いてCompanionで登録する。",
    affiliateUrlAvailability: "creator詳細でプロフィールのアフィURLコピー導線、投稿ごとのアフィURLコピー導線を確認。",
    approvalImpact: "承認済みcreatorタブは現在空のため、LTV候補は一般タブから観測開始する。",
  },
  {
    id: "creator-post-volume",
    label: "クリエイター検索 一般 公開件数が多い順",
    url: "https://www.affiliate.myfans.jp/affiliates/search/creators",
    confirmedSurface: "クリエイター検索のソートにアフィ設定作品の公開件数が多い順を確認。",
    availableInfo: ["creator詳細URL", "投稿数", "フォロワー数", "報酬率", "SNSリンク"],
    approximateItemsPerPage: 20,
    pools: ["ltv"],
    duplicateRisk: "中",
    humanAction: "公開件数が多い順を選び、更新頻度と商品数があるcreatorをCompanionで登録する。",
    affiliateUrlAvailability: "creator詳細で投稿アフィURLを生成/コピーできる。",
    approvalImpact: "承認済みcreatorではない場合も候補登録は可能。投稿時の素材方針は公式OGP/テキスト中心にする。",
  },
  {
    id: "creator-detail",
    label: "クリエイター詳細 投稿一覧",
    url: "https://www.affiliate.myfans.jp/affiliates/search/creators/spgymn",
    confirmedSurface: "クリエイター詳細。プロフィールアフィURLコピー、プラン加入/継続報酬率、プラン価格、投稿一覧、すべて/動画/画像、新しい順を確認。",
    availableInfo: ["creatorプロフィールURL", "フォロワー数", "総いいね", "投稿数", "プラン価格", "プラン説明", "プラン加入/継続報酬率", "投稿URL", "価格", "単品報酬率", "投稿アフィURLコピー"],
    approximateItemsPerPage: 20,
    pools: ["revenue", "ltv"],
    duplicateRisk: "高",
    humanAction: "未登録creatorまたは強いcreatorだけ詳細を開き、上位20件をCompanionで登録する。",
    affiliateUrlAvailability: "プロフィールと投稿の正規アフィURLコピー導線あり。",
    approvalImpact: "詳細上でも承認/プレミアム表示を確認できる。承認済みタブ自体は空。",
  },
  {
    id: "generated-urls",
    label: "生成したURL一覧",
    url: "https://www.affiliate.myfans.jp/affiliates/generated",
    confirmedSurface: "生成したURL一覧。creator別、アフィURL使用/不使用、件数、検索欄を確認。",
    availableInfo: ["creator別生成済みURL件数", "アフィURL使用/不使用", "creator別詳細URL", "検索欄"],
    approximateItemsPerPage: 11,
    pools: ["revenue"],
    duplicateRisk: "低",
    humanAction: "生成済みURLがあるcreator詳細を開き、Companionまたは貼り付け取込で正規URLを補完する。",
    affiliateUrlAvailability: "生成済みURLがあるため正規URL補完に向く。",
    approvalImpact: "creator承認状態は一覧では見えない。詳細側で確認する。",
  },
  {
    id: "url-paste",
    label: "URL貼付 生成済URL直近5件",
    url: "https://www.affiliate.myfans.jp/affiliates/search",
    confirmedSurface: "アフィ検索 > URL貼付。URL入力、アフィURLを生成＆コピー、生成済URL直近5件を確認。",
    availableInfo: ["手入力URL", "直近5件のサムネイル", "creator名", "人気表示", "投稿日", "価格", "生成済みmfco.link URL"],
    approximateItemsPerPage: 5,
    pools: ["revenue"],
    duplicateRisk: "低",
    humanAction: "商品ページURLを貼って生成し、表示された正規アフィURLをCompanionまたは貼り付け取込で保存する。",
    affiliateUrlAvailability: "正規アフィURL生成/コピーが主目的。",
    approvalImpact: "無効作品は生成できないと画面に明記あり。",
  },
];

function isRecent(product: MyfansProduct) {
  return product.is_new || (Date.now() - new Date(product.created_at).getTime()) / 86_400_000 <= 14;
}

function classifyPools(product: MyfansProduct, analytics: MyfansAnalytics) {
  const creatorProductCount = product.creator_id
    ? analytics.products.filter((item) => item.creator_id === product.creator_id).length
    : 1;
  const scores = calculateMyfansOpportunityScores({
    price: product.price,
    rewardRate: product.reward_rate,
    planSignupReward: product.plan_signup_reward,
    recurringRewardRate: product.recurring_reward_rate,
    popularityRank: product.popularity_rank,
    likesCount: product.likes_count,
    savesCount: product.saves_count,
    isNew: product.is_new,
    hasAffiliateUrl: isRegularMfcoAffiliateUrl(product.affiliate_url),
    hasApprovedMedia: Boolean(product.approved_media_name || product.affiliate_media_id || product.approved_media_id),
    source_x_url: product.source_x_url,
    createdAt: product.created_at,
    creatorProductCount,
    observedUpdateCount30d: analytics.products.filter((item) => item.creator_id && item.creator_id === product.creator_id && isRecent(item)).length,
  });
  return {
    scores,
    growth: scores.growthScore >= 55 || isRecent(product) || product.likes_count >= 100 || product.saves_count >= 30,
    revenue: isRegularMfcoAffiliateUrl(product.affiliate_url) && (scores.revenueScore >= 45 || product.reward_rate >= 30 || product.estimated_reward >= 1000),
    ltv: scores.creatorLtvScore >= 45 || product.plan_signup_reward > 0 || product.recurring_reward_rate >= 15 || creatorProductCount >= 5,
  };
}

export function buildMyfansAcquisitionPlanner(analytics: MyfansAnalytics) {
  const activeProducts = analytics.products.filter((product) => product.status !== "paused" && product.status !== "rejected");
  const rows = activeProducts.map((product) => ({ product, ...classifyPools(product, analytics) }));
  const poolCounts = {
    growth: rows.filter((row) => row.growth).length,
    revenue: rows.filter((row) => row.revenue).length,
    ltv: rows.filter((row) => row.ltv).length,
    affiliateReady: activeProducts.filter((product) => isRegularMfcoAffiliateUrl(product.affiliate_url)).length,
    revenueUrlOnly: rows.filter((row) => isRegularMfcoAffiliateUrl(row.product.affiliate_url) && !row.revenue).length,
    recent: activeProducts.filter(isRecent).length,
    uniqueCreators: new Set(activeProducts.map((product) => product.creator_id ?? product.product_url).filter(Boolean)).size,
  };
  const targets = { growth: 15, revenue: 12, ltv: 8, affiliateReady: 10, recent: 8, uniqueCreators: 10 };
  const remainingDailyCapacity = 45;
  const tasks: MyfansAcquisitionTask[] = [];
  const addTask = (id: string, routeId: string, pool: MyfansCandidatePool, targetCount: number, currentCount: number, reason: string, instruction: string) => {
    if (targetCount <= 0) return;
    const route = MYFANS_CONFIRMED_ACQUISITION_ROUTES.find((item) => item.id === routeId);
    if (!route) return;
    const used = tasks.reduce((sum, task) => sum + task.targetCount, 0);
    if (used >= remainingDailyCapacity) return;
    tasks.push({ id, route, pool, targetCount: Math.min(targetCount, remainingDailyCapacity - used), currentCount, reason, instruction });
  };

  addTask(
    "revenue-affiliate-url",
    poolCounts.affiliateReady < targets.affiliateReady ? "generated-urls" : "post-genre-reward",
    "revenue",
    Math.min(12, Math.max(targets.revenue - poolCounts.revenue, targets.affiliateReady - poolCounts.affiliateReady)),
    poolCounts.revenue,
    "Revenue poolは正規mfco.linkに加えて、報酬率・推定報酬・Revenueスコアの条件を満たす商品だけです。URL付き候補とは別に見ます。",
    "生成済みURL一覧または報酬率順の投稿一覧を開き、投稿アフィURLをコピーしてからCompanionで登録してください。",
  );
  addTask(
    "growth-new",
    "post-genre-new-video",
    "growth",
    Math.min(12, Math.max(targets.growth - poolCounts.growth, targets.recent - poolCounts.recent)),
    poolCounts.growth,
    "Growth枠の新着・反応検証サンプルが不足しています。",
    "ジャンル結果で動画と新着順を選び、未登録creatorに偏らせてCompanionで登録してください。",
  );
  addTask(
    "ltv-creator-plan",
    poolCounts.uniqueCreators < targets.uniqueCreators ? "creator-post-volume" : "creator-plan-reward",
    "ltv",
    Math.min(8, Math.max(targets.ltv - poolCounts.ltv, targets.uniqueCreators - poolCounts.uniqueCreators)),
    poolCounts.ltv,
    "LTV枠はプラン報酬、継続報酬、投稿数があるcreator候補を増やす必要があります。",
    "クリエイター検索でプラン報酬単価順または公開件数順を選び、creator詳細を開いてCompanionで登録してください。",
  );
  if (activeProducts.length > 0 && poolCounts.revenue >= targets.revenue && poolCounts.growth >= targets.growth) {
    addTask(
      "popular-validation",
      "post-genre-popular",
      "growth",
      5,
      poolCounts.growth,
      "既存候補は最低数に達しています。今日は人気/いいね/保存順で反応しやすい別creatorを少量だけ補充します。",
      "人気順、いいね順、保存順を切り替え、重複creatorを避けて5件だけ登録してください。",
    );
  }

  return {
    tasks,
    poolCounts,
    targets,
    dailyLimit: remainingDailyCapacity,
    routes: MYFANS_CONFIRMED_ACQUISITION_ROUTES,
    summary: tasks.length
      ? `今日は最大${tasks.reduce((sum, task) => sum + task.targetCount, 0)}件まで、${tasks.map((task) => task.pool).join(" / ")} の不足順に集めます。`
      : "候補プールは最低ラインを満たしています。今日は投稿と計測を優先します。",
  };
}
