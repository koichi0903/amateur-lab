import type {
  MyfansDailyFunnelCreator,
  MyfansDailyFunnelProduct,
  MyfansProduct,
  MyfansQuoteCandidate,
} from "@/lib/myfansAnalytics";

type DailyRole = "ATTENTION" | "DISCOVERY" | "AUTHORITY" | "REVENUE";

export type MyfansLinkedCandidateFunnelCandidate = {
  quoteXUrl: string;
  sourceXUrl: string;
  product: MyfansProduct | null;
  monetizableStatus: string;
};

type SourceUsage = { date: string; actualPosted: boolean };

function appendByKey<T>(map: Map<string, T[]>, key: string, value: T) {
  const rows = map.get(key);
  if (rows) {
    rows.push(value);
    return;
  }
  map.set(key, [value]);
}

type MyfansLinkedCandidateFunnelInput<TBaselines, TCandidate extends MyfansLinkedCandidateFunnelCandidate> = {
  planDate: string;
  inputCoverage: "complete" | "analytics_sample";
  creators: MyfansDailyFunnelCreator[];
  funnelProducts: Array<MyfansProduct | MyfansDailyFunnelProduct>;
  topicProducts: MyfansProduct[];
  quoteCandidates: MyfansQuoteCandidate[];
  topicBaselines: TBaselines;
  latestSourceUsage: (sourceUrl: string) => SourceUsage | null | undefined;
  attemptedCreatorKeys: Set<string>;
  allDailyOptions: TCandidate[];
  finalPublishableCandidates: TCandidate[];
  creatorKeyForCandidateSource: (candidate: Pick<TCandidate, "quoteXUrl" | "sourceXUrl" | "product">) => string;
  creatorKeyFromProduct: (product: Pick<MyfansProduct, "creator_id" | "creator_x_url">) => string;
  creatorKeyFromCreator: (creator: Pick<MyfansDailyFunnelCreator, "id">) => string;
  creatorKeyFromQuote: (quote: MyfansQuoteCandidate) => string;
  hasValidXProfileUrl: (value: string | null | undefined) => boolean;
  daysSinceIsoAtPlanDate: (value: string | null | undefined, planDate: string) => number | null;
  creatorMyfansUrl: (product: MyfansProduct | MyfansDailyFunnelProduct | null | undefined) => string;
  evaluateTopicValue: (input: {
    product: MyfansProduct;
    quote: MyfansQuoteCandidate | null;
    role: DailyRole;
    baselines: TBaselines;
  }) => { verdict: string };
  daysBetweenDates: (laterDate: string, earlierDate: string) => number | null;
  quoteUrlFromCandidate: (quote: MyfansQuoteCandidate) => string;
  dailyFreshDays: number;
  postedSourceCooldownDays: number;
};

export function buildMyfansLinkedCandidateFunnel<
  TBaselines,
  TCandidate extends MyfansLinkedCandidateFunnelCandidate,
>(input: MyfansLinkedCandidateFunnelInput<TBaselines, TCandidate>) {
  const productsByCreatorKey = new Map<string, Array<MyfansProduct | MyfansDailyFunnelProduct>>();
  for (const product of input.funnelProducts) {
    const key = input.creatorKeyFromProduct(product);
    appendByKey(productsByCreatorKey, key, product);
  }
  const topicProductsByCreatorKey = new Map<string, MyfansProduct[]>();
  for (const product of input.topicProducts) {
    const key = input.creatorKeyFromProduct(product);
    appendByKey(topicProductsByCreatorKey, key, product);
  }
  const quoteByCreatorKey = new Map<string, MyfansQuoteCandidate[]>();
  for (const quote of input.quoteCandidates) {
    const key = input.creatorKeyFromQuote(quote);
    appendByKey(quoteByCreatorKey, key, quote);
  }
  const creatorsWithExactX = input.creators.filter((creator) =>
    input.hasValidXProfileUrl(creator.creator_x_url) || input.hasValidXProfileUrl(creator.x_url),
  );
  const creatorFunnelRows = creatorsWithExactX.map((creator) => {
    const key = input.creatorKeyFromCreator(creator);
    const quotes = quoteByCreatorKey.get(key) ?? [];
    const creatorProducts = productsByCreatorKey.get(key) ?? [];
    const topicProducts = topicProductsByCreatorKey.get(key) ?? [];
    const freshQuotes = quotes.filter((quote) => {
      const age = input.daysSinceIsoAtPlanDate(quote.posted_at ?? quote.collected_at, input.planDate);
      return (age === null || age <= input.dailyFreshDays) && !quote.is_repost;
    });
    const eligibleProducts = creatorProducts.filter((product) =>
      product.status !== "paused" && product.status !== "rejected" &&
      Boolean(product.product_url || input.creatorMyfansUrl(product)),
    );
    const topicPass = topicProducts.some((product) => {
      const quote = quotes.find((item) => item.product_id === product.id) ?? quotes[0] ?? null;
      const roles: DailyRole[] = ["ATTENTION", "DISCOVERY", "AUTHORITY", "REVENUE"];
      return roles.some((role) => input.evaluateTopicValue({
        product,
        quote,
        role,
        baselines: input.topicBaselines,
      }).verdict === "PASS");
    });
    const cooldownPass = freshQuotes.some((quote) => {
      const sourceUsage = input.latestSourceUsage(quote.x_post_url) ?? input.latestSourceUsage(input.quoteUrlFromCandidate(quote));
      const sourceAge = sourceUsage ? input.daysBetweenDates(input.planDate, sourceUsage.date) : null;
      return !quote.last_used_at && !quote.cooldown_until &&
        !(sourceUsage?.actualPosted && sourceAge !== null && sourceAge < input.postedSourceCooldownDays);
    });
    const sourceStatusUrl = quotes.some((quote) => Boolean(quote.x_post_url || quote.media_permalink));
    const candidatePool = input.attemptedCreatorKeys.has(key);
    const daily12 = input.allDailyOptions.some((candidate) => input.creatorKeyForCandidateSource(candidate) === key);
    const selected4 = input.finalPublishableCandidates.some((candidate) => input.creatorKeyForCandidateSource(candidate) === key);
    const linkedNoAffiliate = input.allDailyOptions.some((candidate) =>
      input.creatorKeyForCandidateSource(candidate) === key && candidate.monetizableStatus === "linked_no_affiliate",
    );
    const linkedAffiliateReady = input.allDailyOptions.some((candidate) =>
      input.creatorKeyForCandidateSource(candidate) === key && candidate.monetizableStatus === "linked_affiliate_ready",
    );
    const primaryDropReason = !quotes.length ? "quote candidate未接続"
      : !freshQuotes.length ? "fresh quoteなし"
      : !creatorProducts.length ? "product linkageなし"
      : !eligibleProducts.length ? "public/eligible productなし"
      : !topicPass ? "Topic/quality eligibility未達"
      : !cooldownPass ? "cooldown"
      : !sourceStatusUrl ? "source/status URLなし"
      : !candidatePool ? "candidate pool未採用"
      : !daily12 ? "Daily 12未採用"
      : !selected4 ? "selected 4未採用"
      : "selected";
    return {
      key,
      quotes,
      freshQuotes,
      creatorProducts,
      eligibleProducts,
      topicPass,
      cooldownPass,
      sourceStatusUrl,
      candidatePool,
      daily12,
      selected4,
      linkedNoAffiliate,
      linkedAffiliateReady,
      primaryDropReason,
    };
  });
  const countRows = (predicate: (row: (typeof creatorFunnelRows)[number]) => boolean) =>
    creatorFunnelRows.filter(predicate).length;

  return {
    inputCoverage: input.inputCoverage,
    myfansCreatorsTotal: input.creators.length,
    officialExactXHandleAvailable: creatorsWithExactX.length,
    quoteCandidateExactConnected: countRows((row) => row.quotes.length > 0),
    currentFreshQuoteSource: countRows((row) => row.freshQuotes.length > 0),
    productLinkage: countRows((row) => row.creatorProducts.length > 0),
    publicEligibleProduct: countRows((row) => row.eligibleProducts.length > 0),
    topicQualityEligibility: countRows((row) => row.topicPass),
    cooldownPassed: countRows((row) => row.cooldownPass),
    sourceStatusUrl: countRows((row) => row.sourceStatusUrl),
    candidatePool: countRows((row) => row.candidatePool),
    daily12: countRows((row) => row.daily12),
    selected4: countRows((row) => row.selected4),
    linkedNoAffiliate: countRows((row) => row.linkedNoAffiliate),
    linkedAffiliateReady: countRows((row) => row.linkedAffiliateReady),
    primaryDropReasons: Object.entries(creatorFunnelRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.primaryDropReason] = (acc[row.primaryDropReason] ?? 0) + 1;
      return acc;
    }, {})).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    conditionCounts: {
      quotes: countRows((row) => row.quotes.length > 0),
      freshQuotes: countRows((row) => row.freshQuotes.length > 0),
      products: countRows((row) => row.creatorProducts.length > 0),
      eligibleProducts: countRows((row) => row.eligibleProducts.length > 0),
      topicPass: countRows((row) => row.topicPass),
      cooldownPass: countRows((row) => row.cooldownPass),
      sourceStatusUrl: countRows((row) => row.sourceStatusUrl),
    },
  };
}
