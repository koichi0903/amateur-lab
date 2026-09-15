import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type MyfansCreator = {
  id: number;
  display_name: string;
  genre: string;
  myfans_url: string;
  x_url: string;
  creator_x_url?: string;
  source_x_handle?: string;
  latest_quote_x_url?: string;
  is_active: boolean;
  created_at: string;
};

export type MyfansProduct = {
  id: number;
  creator_id: number | null;
  approved_media_id?: number | null;
  title: string;
  product_url: string;
  genre: string;
  product_type: string;
  status: string;
  price: number;
  reward_rate: number;
  estimated_reward: number;
  plan_signup_reward: number;
  recurring_reward_rate: number;
  popularity_rank: number | null;
  likes_count: number;
  saves_count: number;
  is_new: boolean;
  source_x_url: string;
  creator_x_url?: string;
  quote_candidate_x_url?: string;
  affiliate_url: string;
  affiliate_url_generated_at?: string | null;
  affiliate_url_expires_at?: string | null;
  affiliate_url_source?: string | null;
  media_permission_status?: string;
  media_permission_note?: string;
  selection_reason: string;
  approved_media_name?: string;
  approved_media_url?: string;
  affiliate_media_id?: string;
  selection_score?: number;
  launch_priority?: string;
  created_at: string;
  myfans_creators?: Pick<MyfansCreator, "display_name"> | null;
};

export type MyfansXPost = {
  id: number;
  product_id: number | null;
  post_type: string;
  status: string;
  body: string;
  self_reply: string;
  includes_pr: boolean;
  source_x_url: string;
  affiliate_url: string;
  selection_reason: string;
  scheduled_at: string | null;
  posted_at: string | null;
  x_post_url: string;
  x_post_id?: string;
  impressions: number;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  clicks?: number;
  growth_stage?: string;
  link_strategy?: string;
  cta_strategy?: string;
  creative_variant_id?: string;
  creative_strategy?: string;
  creative_reason?: string;
  card_payload?: Record<string, unknown>;
  ogp_check_required?: boolean;
  quote_x_url?: string;
  media_permission_status?: string;
  planned_slot?: string;
  objective?: string;
  approved_media_name?: string;
  approved_media_id?: number | null;
  growth_score_snapshot?: number;
  revenue_score_snapshot?: number;
  creator_ltv_score_snapshot?: number;
  expected_reward_per_1000_impressions_snapshot?: number;
  metrics_sync_error?: string;
  metrics_recorded_at?: string | null;
  created_at: string;
  myfans_products?: Pick<MyfansProduct, "title" | "price" | "estimated_reward"> | null;
};

export type MyfansConversion = {
  id: number;
  product_id: number | null;
  x_post_id: number | null;
  conversion_type: string;
  occurred_at: string;
  sale_amount: number;
  reward_amount: number;
  reward_rate: number;
  source_file: string;
  myfans_products?: Pick<MyfansProduct, "title"> | null;
};

export type MyfansDailyMetric = {
  metric_date: string;
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  reward_amount: number;
};

export type MyfansApprovedMedia = {
  id: number;
  media_name: string;
  media_url: string;
  affiliate_media_id: string;
  status: string;
  notes: string;
  created_at: string;
};

export type MyfansXAccountMetric = {
  id: number;
  metric_date: string;
  approved_media_id: number;
  followers_count: number;
  following_count: number | null;
  profile_visits: number;
  total_impressions: number;
  posts_count: number;
  likes: number;
  reposts: number;
  replies: number;
  affiliate_clicks: number;
  conversions: number;
  reward_amount: number;
  notes: string;
  myfans_approved_media?: Pick<MyfansApprovedMedia, "media_name"> | null;
};

export type MyfansAuditLog = {
  id: number;
  entity_type: string;
  entity_id: number | null;
  action: string;
  summary: string;
  created_at: string;
};

export type MyfansQuoteCandidate = {
  id: number;
  approved_media_id: number | null;
  creator_id: number | null;
  product_id: number | null;
  creator_x_url: string;
  source_x_handle: string;
  x_post_url: string;
  media_permalink?: string | null;
  media_type?: "image" | "video" | "none" | null;
  media_count?: number | null;
  quote_visual_ready?: boolean;
  media_permalink_verified_at?: string | null;
  media_permalink_validation_status?: string | null;
  visual_render_status?: "browser_visible" | "app_only" | "blocked" | "unknown" | null;
  visual_score?: number | null;
  posted_at: string | null;
  text_excerpt: string;
  views: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  bookmarks: number | null;
  has_image: boolean;
  has_video: boolean;
  is_pinned: boolean;
  is_reply: boolean;
  is_repost: boolean;
  is_quote: boolean;
  collected_at: string;
  score: number;
  score_reason: string;
  selected: boolean;
  creator_rank?: number | null;
  global_score?: number | null;
  global_rank?: number | null;
  last_used_at?: string | null;
  use_count?: number;
  cooldown_until?: string | null;
  selected_for_today?: boolean;
  visual_analysis_status?: "verified" | "partial" | "unavailable" | null;
  visual_analysis_json?: Record<string, unknown> | null;
  visual_analyzed_at?: string | null;
  visual_analyzer_version?: string | null;
};

type MyfansXGrowthDiagnosis =
  | "露出不足"
  | "露出はあるがプロフィール遷移不足"
  | "プロフィール遷移はあるがフォロー不足"
  | "フォローは増えるがクリック不足"
  | "クリックあり/CV不足"
  | "成果発生・最適化段階";

const EMPTY_ANALYTICS = {
  totals: {
    products: 0,
    creators: 0,
    draftPosts: 0,
    readyPosts: 0,
    postedPosts: 0,
    impressions30d: 0,
    clicks30d: 0,
    conversions30d: 0,
    reward30d: 0,
    ctr30d: null as number | null,
    cvr30d: null as number | null,
    epc30d: null as number | null,
  },
  xAccountGrowth: {
    diagnosis: "露出不足" as MyfansXGrowthDiagnosis,
    currentFollowers: 0,
    followersDelta30d: 0,
    newFollows30d: 0,
    profileVisits30d: 0,
    impressions30d: 0,
    posts30d: 0,
    avgImpressionsPerPost: null as number | null,
    highestPost: null as MyfansXPost | null,
    clicks30d: 0,
    conversions30d: 0,
    reward30d: 0,
    ctr30d: null as number | null,
    cvr30d: null as number | null,
    epc30d: null as number | null,
    dailyRows: [] as Array<{
      metric_date: string;
      followers_count: number;
      posts_count: number;
      impressions: number;
      profile_visits: number;
      affiliate_clicks: number;
      conversions: number;
      reward_amount: number;
      epc: number | null;
    }>,
  },
  products: [] as MyfansProduct[],
  creators: [] as MyfansCreator[],
  posts: [] as MyfansXPost[],
  conversions: [] as MyfansConversion[],
  daily: [] as MyfansDailyMetric[],
  media: [] as MyfansApprovedMedia[],
  auditLogs: [] as MyfansAuditLog[],
  quoteCandidates: [] as MyfansQuoteCandidate[],
  quoteCandidateSource: {
    dbCount: 0,
    loadedCount: 0,
    pageSize: 1000,
    loadedAll: true,
    latestCollectedAt: null as string | null,
  },
  selectedMediaId: null as number | null,
  selectedMedia: null as MyfansApprovedMedia | null,
};

export type MyfansAnalytics = typeof EMPTY_ANALYTICS & {
  error: string | null;
  xAccountMetrics?: MyfansXAccountMetric[];
};

function thirtyDaysAgoIso() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "myfansデータを読み込めませんでした";
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function diagnoseXGrowth(impressions: number, profileVisits: number, followersDelta: number, clicks: number, conversions: number) {
  if (conversions > 0) return "成果発生・最適化段階" as const;
  if (clicks > 0) return "クリックあり/CV不足" as const;
  if (followersDelta > 0) return "フォローは増えるがクリック不足" as const;
  if (profileVisits > 0) return "プロフィール遷移はあるがフォロー不足" as const;
  if (impressions >= 1000) return "露出はあるがプロフィール遷移不足" as const;
  return "露出不足" as const;
}

type MyfansAnalyticsOptions = {
  approvedMediaId?: number | null;
};

function matchesMediaName(rowName: string | undefined, media: MyfansApprovedMedia | null) {
  if (!media) return true;
  return Boolean(rowName && rowName === media.media_name);
}

function filterBySelectedMedia<T extends { approved_media_id?: number | null; approved_media_name?: string; affiliate_media_id?: string }>(
  rows: T[],
  selectedMedia: MyfansApprovedMedia | null,
) {
  if (!selectedMedia) return rows;
  return rows.filter((row) =>
    row.approved_media_id === selectedMedia.id ||
    matchesMediaName(row.approved_media_name, selectedMedia) ||
    Boolean(row.affiliate_media_id && row.affiliate_media_id === selectedMedia.affiliate_media_id),
  );
}

const QUOTE_CANDIDATE_SELECT =
  "id,approved_media_id,creator_id,product_id,creator_x_url,source_x_handle,x_post_url,media_permalink,media_type,media_count,quote_visual_ready,media_permalink_verified_at,media_permalink_validation_status,visual_render_status,visual_score,posted_at,text_excerpt,views,likes,reposts,replies,bookmarks,has_image,has_video,is_pinned,is_reply,is_repost,is_quote,collected_at,score,score_reason,selected,creator_rank,global_score,global_rank,last_used_at,use_count,cooldown_until,selected_for_today,visual_analysis_status,visual_analysis_json,visual_analyzed_at,visual_analyzer_version";
const QUOTE_CANDIDATE_SELECT_LEGACY =
  "id,approved_media_id,creator_id,product_id,creator_x_url,source_x_handle,x_post_url,media_permalink,media_type,media_count,quote_visual_ready,media_permalink_verified_at,media_permalink_validation_status,visual_score,posted_at,text_excerpt,views,likes,reposts,replies,bookmarks,has_image,has_video,is_pinned,is_reply,is_repost,is_quote,collected_at,score,score_reason,selected,creator_rank,global_score,global_rank,last_used_at,use_count,cooldown_until,selected_for_today";
const MYFANS_X_POST_SELECT_BASE =
  "id,product_id,post_type,status,body,self_reply,includes_pr,source_x_url,affiliate_url,selection_reason,scheduled_at,posted_at,x_post_url,x_post_id,impressions,likes_count,reposts_count,replies_count,clicks,growth_stage,link_strategy,cta_strategy,creative_variant_id,creative_strategy,creative_reason,card_payload,ogp_check_required,quote_x_url,media_permission_status,planned_slot,objective,approved_media_name,approved_media_id,growth_score_snapshot,revenue_score_snapshot,creator_ltv_score_snapshot,expected_reward_per_1000_impressions_snapshot,metrics_sync_error,created_at,myfans_products(title,price,estimated_reward)";
const MYFANS_X_POST_SELECT_WITH_METRICS_RECORDED =
  MYFANS_X_POST_SELECT_BASE.replace("created_at,", "metrics_recorded_at,created_at,");
const MYFANS_PRODUCT_SELECT_BASE =
  "id,creator_id,approved_media_id,title,product_url,genre,product_type,status,price,reward_rate,estimated_reward,plan_signup_reward,recurring_reward_rate,popularity_rank,likes_count,saves_count,is_new,source_x_url,creator_x_url,quote_candidate_x_url,affiliate_url,media_permission_status,media_permission_note,selection_reason,approved_media_name,approved_media_url,affiliate_media_id,selection_score,launch_priority,created_at,myfans_creators(display_name)";
const MYFANS_PRODUCT_SELECT_WITH_AFFILIATE_METADATA =
  MYFANS_PRODUCT_SELECT_BASE.replace("affiliate_url,", "affiliate_url,affiliate_url_generated_at,affiliate_url_expires_at,affiliate_url_source,");

async function fetchMyfansXPosts() {
  const withRecorded = await supabaseAdmin
    .from("myfans_x_posts")
    .select(MYFANS_X_POST_SELECT_WITH_METRICS_RECORDED)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!withRecorded.error || !/metrics_recorded_at|schema cache|column/i.test(withRecorded.error.message)) return withRecorded;
  return supabaseAdmin
    .from("myfans_x_posts")
    .select(MYFANS_X_POST_SELECT_BASE)
    .order("created_at", { ascending: false })
    .limit(100);
}

async function fetchMyfansProducts() {
  const withMetadata = await supabaseAdmin
    .from("myfans_products")
    .select(MYFANS_PRODUCT_SELECT_WITH_AFFILIATE_METADATA, { count: "exact" })
    .order("selection_score", { ascending: false })
    .limit(100);
  if (!withMetadata.error || !/affiliate_url_generated_at|affiliate_url_expires_at|affiliate_url_source|schema cache|column/i.test(withMetadata.error.message)) return withMetadata;
  return supabaseAdmin
    .from("myfans_products")
    .select(MYFANS_PRODUCT_SELECT_BASE, { count: "exact" })
    .order("selection_score", { ascending: false })
    .limit(100);
}

async function fetchAllMyfansQuoteCandidates() {
  const pageSize = 1000;
  const data: MyfansQuoteCandidate[] = [];
  let count = 0;
  let from = 0;

  let select = QUOTE_CANDIDATE_SELECT;
  while (true) {
    const result = await supabaseAdmin
      .from("myfans_quote_candidates")
      .select(select, from === 0 ? { count: "exact" } : undefined)
      .order("collected_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (result.error) {
      if (select === QUOTE_CANDIDATE_SELECT && /visual_analysis|visual_analyzed|visual_analyzer|schema cache|column/i.test(result.error.message)) {
        select = QUOTE_CANDIDATE_SELECT_LEGACY;
        data.length = 0;
        count = 0;
        from = 0;
        continue;
      }
      return { data, count, pageSize, error: result.error };
    }
    if (from === 0) count = result.count ?? 0;

    const page = (result.data ?? []) as unknown as MyfansQuoteCandidate[];
    data.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return { data, count: count || data.length, pageSize, error: null };
}

export async function getMyfansAnalytics(options: MyfansAnalyticsOptions = {}) {
  try {
    const cutoff = thirtyDaysAgoIso();
    const [
      creatorsResult,
      productsResult,
      postsResult,
      clicksResult,
      conversionsResult,
      dailyResult,
      mediaResult,
      xAccountMetricsResult,
      auditResult,
      quoteCandidatesResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("myfans_creators")
        .select("id,display_name,genre,myfans_url,x_url,creator_x_url,source_x_handle,latest_quote_x_url,is_active,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(500),
      fetchMyfansProducts(),
      fetchMyfansXPosts(),
      supabaseAdmin
        .from("myfans_affiliate_clicks")
        .select("id", { count: "exact", head: true })
        .gte("clicked_at", cutoff),
      supabaseAdmin
        .from("myfans_conversions")
        .select("id,product_id,x_post_id,conversion_type,occurred_at,sale_amount,reward_amount,reward_rate,source_file,myfans_products(title)")
        .gte("occurred_at", cutoff)
        .order("occurred_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("myfans_daily_metrics")
        .select("metric_date,impressions,engagements,clicks,conversions,reward_amount")
        .gte("metric_date", cutoff.slice(0, 10))
        .order("metric_date", { ascending: true })
        .limit(30),
      supabaseAdmin
        .from("myfans_approved_media")
        .select("id,media_name,media_url,affiliate_media_id,status,notes,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("myfans_x_account_metrics")
        .select("id,metric_date,approved_media_id,followers_count,following_count,profile_visits,total_impressions,posts_count,likes,reposts,replies,affiliate_clicks,conversions,reward_amount,notes,myfans_approved_media(media_name)")
        .gte("metric_date", cutoff.slice(0, 10))
        .order("metric_date", { ascending: true })
        .limit(30),
      supabaseAdmin
        .from("myfans_audit_logs")
        .select("id,entity_type,entity_id,action,summary,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      fetchAllMyfansQuoteCandidates(),
    ]);

    const error = [
      creatorsResult.error,
      productsResult.error,
      postsResult.error,
      clicksResult.error,
      conversionsResult.error,
      dailyResult.error,
      mediaResult.error,
      xAccountMetricsResult.error,
      auditResult.error,
      quoteCandidatesResult.error,
    ].find(Boolean);

    if (error) {
      return { error: error.message, ...EMPTY_ANALYTICS };
    }

    const media = (mediaResult.data ?? []) as MyfansApprovedMedia[];
    const selectedMedia = options.approvedMediaId
      ? media.find((item) => item.id === options.approvedMediaId) ?? null
      : media.find((item) => item.status === "active") ?? media[0] ?? null;

    const allProducts = ((productsResult.data ?? []) as Array<
      Omit<MyfansProduct, "myfans_creators"> & {
        myfans_creators?: Pick<MyfansCreator, "display_name"> | Array<Pick<MyfansCreator, "display_name">> | null;
      }
    >).map((product) => ({
      ...product,
      myfans_creators: firstRelation(product.myfans_creators),
    }));
    const allPosts = ((postsResult.data ?? []) as Array<
      Omit<MyfansXPost, "myfans_products"> & {
        myfans_products?: Pick<MyfansProduct, "title" | "price" | "estimated_reward"> | Array<Pick<MyfansProduct, "title" | "price" | "estimated_reward">> | null;
      }
    >).map((post) => ({
      ...post,
      myfans_products: firstRelation(post.myfans_products),
    }));
    const allConversions = ((conversionsResult.data ?? []) as Array<
      Omit<MyfansConversion, "myfans_products"> & {
        myfans_products?: Pick<MyfansProduct, "title"> | Array<Pick<MyfansProduct, "title">> | null;
      }
    >).map((conversion) => ({
      ...conversion,
      myfans_products: firstRelation(conversion.myfans_products),
    }));
    const products = filterBySelectedMedia(allProducts, selectedMedia);
    const productIds = new Set(products.map((product) => product.id));
    const quoteCandidates = ((quoteCandidatesResult.data ?? []) as MyfansQuoteCandidate[])
      .filter((row) => !selectedMedia || row.approved_media_id === selectedMedia.id || row.approved_media_id === null);
    const quoteCandidateSource = {
      dbCount: quoteCandidatesResult.count ?? quoteCandidates.length,
      loadedCount: quoteCandidatesResult.data.length,
      pageSize: quoteCandidatesResult.pageSize,
      loadedAll: quoteCandidatesResult.data.length >= (quoteCandidatesResult.count ?? quoteCandidatesResult.data.length),
      latestCollectedAt: quoteCandidatesResult.data[0]?.collected_at ?? null,
    };
    const posts = filterBySelectedMedia(allPosts, selectedMedia).filter((post) => !post.product_id || productIds.has(post.product_id));
    const conversions = allConversions.filter((conversion) => !conversion.product_id || productIds.has(conversion.product_id));

    const reward30d = conversions.reduce((sum, row) => sum + row.reward_amount, 0);
    const conversions30d = conversions.length;
    const clicks30d = clicksResult.count ?? 0;
    const daily = (dailyResult.data ?? []) as MyfansDailyMetric[];
    const xAccountMetrics = ((xAccountMetricsResult.data ?? []) as Array<
      Omit<MyfansXAccountMetric, "myfans_approved_media"> & {
        myfans_approved_media?: Pick<MyfansApprovedMedia, "media_name"> | Array<Pick<MyfansApprovedMedia, "media_name">> | null;
      }
    >).map((row) => ({
      ...row,
      myfans_approved_media: firstRelation(row.myfans_approved_media),
    })).filter((row) => !selectedMedia || row.approved_media_id === selectedMedia.id);
    const postImpressions30d = posts
      .filter((post) => post.created_at >= cutoff || (post.posted_at && post.posted_at >= cutoff))
      .reduce((sum, post) => sum + post.impressions, 0);
    const dailyImpressions30d = daily.reduce((sum, row) => sum + row.impressions, 0);
    const impressions30d = Math.max(postImpressions30d, dailyImpressions30d);
    const postedPosts30d = posts.filter((post) => post.posted_at && post.posted_at >= cutoff);
    const highestPost = postedPosts30d.reduce<MyfansXPost | null>(
      (best, post) => (!best || post.impressions > best.impressions ? post : best),
      null,
    );
    const firstAccountMetric = xAccountMetrics[0] ?? null;
    const latestAccountMetric = xAccountMetrics[xAccountMetrics.length - 1] ?? null;
    const profileVisits30d = xAccountMetrics.reduce((sum, row) => sum + row.profile_visits, 0);
    const accountPosts30d = xAccountMetrics.reduce((sum, row) => sum + row.posts_count, 0);
    const accountImpressions30d = Math.max(
      postImpressions30d,
      xAccountMetrics.reduce((sum, row) => sum + row.total_impressions, 0),
    );
    const accountMetricClicks30d = xAccountMetrics.reduce((sum, row) => sum + row.affiliate_clicks, 0);
    const accountMetricConversions30d = xAccountMetrics.reduce((sum, row) => sum + row.conversions, 0);
    const accountMetricReward30d = xAccountMetrics.reduce((sum, row) => sum + row.reward_amount, 0);
    const accountClicks30d = Math.max(
      clicks30d,
      postedPosts30d.reduce((sum, post) => sum + (post.clicks ?? 0), 0),
      accountMetricClicks30d,
    );
    const accountConversions30d = Math.max(conversions30d, accountMetricConversions30d);
    const accountReward30d = Math.max(reward30d, accountMetricReward30d);
    const followersDelta30d = latestAccountMetric && firstAccountMetric ? latestAccountMetric.followers_count - firstAccountMetric.followers_count : 0;
    const dailyRows = xAccountMetrics.map((row) => ({
      metric_date: row.metric_date,
      followers_count: row.followers_count,
      posts_count: row.posts_count,
      impressions: row.total_impressions,
      profile_visits: row.profile_visits,
      affiliate_clicks: row.affiliate_clicks,
      conversions: row.conversions,
      reward_amount: row.reward_amount,
      epc: row.affiliate_clicks > 0 ? Math.round(row.reward_amount / row.affiliate_clicks) : null,
    }));

    return {
      error: null as string | null,
      totals: {
        products: productsResult.count ?? 0,
        creators: creatorsResult.count ?? 0,
        draftPosts: posts.filter((post) => post.status === "draft").length,
        readyPosts: posts.filter((post) => post.status === "ready").length,
        postedPosts: posts.filter((post) => post.status === "posted").length,
        impressions30d,
        clicks30d,
        conversions30d,
        reward30d,
        ctr30d: impressions30d > 0 ? clicks30d / impressions30d : null,
        cvr30d: clicks30d > 0 ? conversions30d / clicks30d : null,
        epc30d: clicks30d > 0 ? Math.round(reward30d / clicks30d) : null,
      },
      xAccountGrowth: {
        diagnosis: diagnoseXGrowth(accountImpressions30d, profileVisits30d, followersDelta30d, accountClicks30d, accountConversions30d),
        currentFollowers: latestAccountMetric?.followers_count ?? 0,
        followersDelta30d,
        newFollows30d: Math.max(0, followersDelta30d),
        profileVisits30d,
        impressions30d: accountImpressions30d,
        posts30d: accountPosts30d || postedPosts30d.length,
        avgImpressionsPerPost: (accountPosts30d || postedPosts30d.length) > 0 ? Math.round(accountImpressions30d / (accountPosts30d || postedPosts30d.length)) : null,
        highestPost,
        clicks30d: accountClicks30d,
        conversions30d: accountConversions30d,
        reward30d: accountReward30d,
        ctr30d: accountImpressions30d > 0 ? accountClicks30d / accountImpressions30d : null,
        cvr30d: accountClicks30d > 0 ? accountConversions30d / accountClicks30d : null,
        epc30d: accountClicks30d > 0 ? Math.round(accountReward30d / accountClicks30d) : null,
        dailyRows,
      },
      products,
      creators: (creatorsResult.data ?? []) as MyfansCreator[],
      posts,
      conversions,
      daily,
      media,
      selectedMediaId: selectedMedia?.id ?? null,
      selectedMedia,
      xAccountMetrics,
      auditLogs: (auditResult.data ?? []) as MyfansAuditLog[],
      quoteCandidates,
      quoteCandidateSource,
    };
  } catch (error) {
    return { error: toErrorMessage(error), ...EMPTY_ANALYTICS };
  }
}
