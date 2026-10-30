import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllMyfansDailyFunnelInputs, fetchAllMyfansQuoteCandidates, fetchMyfansProducts, fetchMyfansXPosts, firstRelation } from "./myfansAnalyticsQueries";
import type { MyfansPostProductLinkageEvidence } from "@/lib/myfansProductResolver";
import { derivePostedExclusions, fetchMyfansPermanentExclusions, type MyfansPermanentExclusion } from "@/lib/myfansPermanentExclusions";
import { buildMyfansXAccountGrowthSummary } from "./myfansAnalyticsGrowth";
import { firstMyfansAnalyticsLoadError, ignoreUnavailableOptionalMyfansTable } from "./myfansAnalyticsLoadErrors";
import { selectMyfansAnalyticsRows } from "./myfansAnalyticsSelection";
export { filterBySelectedMedia } from "./myfansAnalyticsSelection";

import type {
  MyfansCreator,
  MyfansProduct,
  MyfansDailyFunnelInputs,
  MyfansXPost,
  MyfansConversion,
  MyfansDailyMetric,
  MyfansApprovedMedia,
  MyfansXAccountMetric,
  MyfansAuditLog,
  MyfansQuoteCandidate,
  MyfansDailyPlanHistory,
  MyfansXGrowthDiagnosis,
} from "./myfansAnalyticsTypes";
export type {
  MyfansCreator,
  MyfansProduct,
  MyfansDailyFunnelCreator,
  MyfansDailyFunnelProduct,
  MyfansDailyFunnelInputs,
  MyfansXPost,
  MyfansConversion,
  MyfansDailyMetric,
  MyfansApprovedMedia,
  MyfansXAccountMetric,
  MyfansAuditLog,
  MyfansQuoteCandidate,
  MyfansDailyPlanHistory,
  MyfansXGrowthDiagnosis,
} from "./myfansAnalyticsTypes";

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
  productLinkageEvidence: [] as MyfansPostProductLinkageEvidence[],
  diagnosticProductLinkageEvidence: [] as MyfansPostProductLinkageEvidence[],
  dailyPlans: [] as MyfansDailyPlanHistory[],
  permanentExclusions: [] as MyfansPermanentExclusion[],
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
  dailyFunnelInputs?: MyfansDailyFunnelInputs;
};

function thirtyDaysAgoIso() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function rowsOrEmpty<T>(rows: unknown) {
  return (rows ?? []) as T[];
}

function rowsOnlyIfQuerySucceeded<T>(error: unknown, rows: unknown) {
  return error ? [] as T[] : rowsOrEmpty<T>(rows);
}

function countOrZero(count: number | null | undefined) {
  return count ?? 0;
}

function chooseApprovedMedia(media: MyfansApprovedMedia[], requestedId?: number | null) {
  if (requestedId) return media.find((item) => item.id === requestedId) ?? null;
  return media.find((item) => item.status === "active") ?? media[0] ?? null;
}

function quoteCandidateSourceFor(result: {
  count: number | null;
  data: MyfansQuoteCandidate[];
  pageSize: number;
}) {
  const loadedCount = result.data.length;
  const dbCount = result.count ?? loadedCount;
  return {
    dbCount,
    loadedCount,
    pageSize: result.pageSize,
    loadedAll: loadedCount >= dbCount,
    latestCollectedAt: result.data[0]?.collected_at ?? null,
  };
}

function countPostsWithStatus(posts: MyfansXPost[], status: string) {
  return posts.filter((post) => post.status === status).length;
}

function ratioOrNull(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function rewardPerClickOrNull(reward: number, clicks: number) {
  return clicks > 0 ? Math.round(reward / clicks) : null;
}

function optionalDailyFunnelInputs(data: MyfansDailyFunnelInputs | null | undefined) {
  return data ? { dailyFunnelInputs: data } : {};
}

function permanentExclusionsOrDerived(
  data: MyfansPermanentExclusion[] | null | undefined,
  posts: MyfansXPost[],
) {
  return data ?? derivePostedExclusions(posts);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "myfansデータを読み込めませんでした";
}



type MyfansAnalyticsOptions = {
  approvedMediaId?: number | null;
  includeCompleteDailyFunnelInputs?: boolean;
};

type MyfansProductQueryRow = Omit<MyfansProduct, "myfans_creators"> & {
  myfans_creators?: Pick<MyfansCreator, "display_name"> | Array<Pick<MyfansCreator, "display_name">> | null;
};
type MyfansPostQueryRow = Omit<MyfansXPost, "myfans_products"> & {
  myfans_products?: Pick<MyfansProduct, "title" | "price" | "estimated_reward"> | Array<Pick<MyfansProduct, "title" | "price" | "estimated_reward">> | null;
};
type MyfansConversionQueryRow = Omit<MyfansConversion, "myfans_products"> & {
  myfans_products?: Pick<MyfansProduct, "title"> | Array<Pick<MyfansProduct, "title">> | null;
};
type MyfansXAccountMetricQueryRow = Omit<MyfansXAccountMetric, "myfans_approved_media"> & {
  myfans_approved_media?: Pick<MyfansApprovedMedia, "media_name"> | Array<Pick<MyfansApprovedMedia, "media_name">> | null;
};

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
      productLinkageEvidenceResult,
      dailyPlansResult,
      permanentExclusionsResult,
      dailyFunnelInputsResult,
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
        .select("id,approved_media_id", { count: "exact" })
        .gte("clicked_at", cutoff),
      supabaseAdmin
        .from("myfans_conversions")
        .select("id,approved_media_id,product_id,x_post_id,conversion_type,occurred_at,sale_amount,reward_amount,reward_rate,source_file,myfans_products(title)")
        .gte("occurred_at", cutoff)
        .order("occurred_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("myfans_daily_metrics")
        .select("approved_media_id,metric_date,impressions,engagements,clicks,conversions,reward_amount")
        .gte("metric_date", cutoff.slice(0, 10))
        .order("metric_date", { ascending: true })
        .limit(30),
      supabaseAdmin
        .from("myfans_approved_media")
        .select("id,media_name,media_url,affiliate_media_id,status,notes,created_at,account_key,strategy_type")
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
      supabaseAdmin
        .from("myfans_post_product_linkage_evidence")
        .select("id,approved_media_id,quote_candidate_id,source_status_url,source_author_handle,discovered_myfans_url,final_myfans_url,product_id,resolution_method,confidence,evidence_source,verified_at,metadata,diagnostic_mode,diagnostic_run_id")
        .order("verified_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("myfans_daily_plans")
        .select("id,plan_date,approved_media_id,revision,strategy_json,updated_at,evaluated_at")
        .gte("plan_date", cutoff.slice(0, 10))
        .order("plan_date", { ascending: false })
        .limit(30),
      fetchMyfansPermanentExclusions(options.approvedMediaId),
      options.includeCompleteDailyFunnelInputs
        ? fetchAllMyfansDailyFunnelInputs().then((data) => ({ data, error: null as { message: string } | null }))
        : Promise.resolve({ data: null, error: null as { message: string } | null }),
    ]);

    const error = firstMyfansAnalyticsLoadError([
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
      ignoreUnavailableOptionalMyfansTable(productLinkageEvidenceResult.error),
      dailyPlansResult.error,
      ignoreUnavailableOptionalMyfansTable(permanentExclusionsResult.error),
      dailyFunnelInputsResult.error,
    ]);

    if (error) {
      return { error: error.message, ...EMPTY_ANALYTICS };
    }

    const media = rowsOrEmpty<MyfansApprovedMedia>(mediaResult.data);
    const selectedMedia = chooseApprovedMedia(media, options.approvedMediaId);

    const allProducts = rowsOrEmpty<MyfansProductQueryRow>(productsResult.data).map((product) => ({
      ...product,
      myfans_creators: firstRelation(product.myfans_creators),
    }));
    const allPosts = rowsOrEmpty<MyfansPostQueryRow>(postsResult.data).map((post) => ({
      ...post,
      myfans_products: firstRelation(post.myfans_products),
    }));
    const allConversions = rowsOrEmpty<MyfansConversionQueryRow>(conversionsResult.data).map((conversion) => ({
      ...conversion,
      myfans_products: firstRelation(conversion.myfans_products),
    }));
    // Market Winner consumes the shared supply pool by reference. These rows
    // are never copied or reassigned to account 5; operational history remains
    // filtered by the selected account below.
    const selection = selectMyfansAnalyticsRows({
      allProducts,
      allPosts,
      allConversions,
      clickRows: rowsOrEmpty<{ approved_media_id?: number | null }>(clicksResult.data),
      dailyRows: rowsOrEmpty<MyfansDailyMetric>(dailyResult.data),
      xAccountMetrics: rowsOrEmpty<MyfansXAccountMetricQueryRow>(xAccountMetricsResult.data).map((row) => ({
        ...row,
        myfans_approved_media: firstRelation(row.myfans_approved_media),
      })),
      quoteCandidates: rowsOrEmpty<MyfansQuoteCandidate>(quoteCandidatesResult.data),
      productLinkageEvidence: rowsOnlyIfQuerySucceeded<MyfansPostProductLinkageEvidence>(
        productLinkageEvidenceResult.error, productLinkageEvidenceResult.data,
      ),
      dailyPlans: rowsOrEmpty<MyfansDailyPlanHistory>(dailyPlansResult.data),
      selectedMedia,
    });
    const quoteCandidateSource = quoteCandidateSourceFor(quoteCandidatesResult);
    const {
      products,
      posts,
      conversions,
      clicks30d,
      daily,
      xAccountMetrics,
      quoteCandidates,
      productLinkageEvidence,
      diagnosticProductLinkageEvidence,
      dailyPlans,
    } = selection;
    const reward30d = conversions.reduce((sum, row) => sum + row.reward_amount, 0);
    const conversions30d = conversions.length;
    const growthSummary = buildMyfansXAccountGrowthSummary({
      posts,
      daily,
      xAccountMetrics,
      cutoff,
      clicks30d,
      conversions30d,
      reward30d,
    });
    const { impressions30d, xAccountGrowth } = growthSummary;

    return {
      error: null as string | null,
      totals: {
        products: countOrZero(productsResult.count),
        creators: countOrZero(creatorsResult.count),
        draftPosts: countPostsWithStatus(posts, "draft"),
        readyPosts: countPostsWithStatus(posts, "ready"),
        postedPosts: countPostsWithStatus(posts, "posted"),
        impressions30d,
        clicks30d,
        conversions30d,
        reward30d,
        ctr30d: ratioOrNull(clicks30d, impressions30d),
        cvr30d: ratioOrNull(conversions30d, clicks30d),
        epc30d: rewardPerClickOrNull(reward30d, clicks30d),
      },
      xAccountGrowth,
      products,
      creators: rowsOrEmpty<MyfansCreator>(creatorsResult.data),
      posts,
      conversions,
      daily,
      media,
      selectedMediaId: selectedMedia?.id ?? null,
      selectedMedia,
      xAccountMetrics,
      auditLogs: rowsOrEmpty<MyfansAuditLog>(auditResult.data),
      quoteCandidates,
      productLinkageEvidence,
      diagnosticProductLinkageEvidence,
      quoteCandidateSource,
      dailyPlans,
      permanentExclusions: permanentExclusionsOrDerived(permanentExclusionsResult.data, posts) as MyfansPermanentExclusion[],
      ...optionalDailyFunnelInputs(dailyFunnelInputsResult.data),
    };
  } catch (error) {
    return { error: toErrorMessage(error), ...EMPTY_ANALYTICS };
  }
}
