type DmmApiResult = {
  status?: number | string;
  code?: number | string;
  items?: unknown;
  actress?: unknown;
  total_count?: number | string;
};

type DmmApiResponse = { result?: unknown };

type DmmActress = {
  id?: number | string;
  actress_id?: number | string;
  name?: unknown;
};

type StageDiagnostic = {
  httpStatus: number | null;
  logicalStatus: string | null;
  logicalCode: string | null;
  totalCount: number | null;
  itemsLength: number | null;
  responseShape: "valid" | "invalid" | "unavailable";
};

export type DmmSearchDiagnostics = {
  requestedKeyword: string;
  primary: StageDiagnostic;
  actressSearch: StageDiagnostic & {
    attempted: boolean;
    returnedCount: number;
    exactMatchCount: number;
    exactMatches: Array<{ name: string; actress_id: string }>;
  };
  actressFallback: StageDiagnostic & {
    attempted: boolean;
    selectedActressId: string | null;
  };
  finalSource: "keyword" | "actress" | "none";
  normalizedFinalItemsLength: number;
};

type DmmCall = {
  response: Response;
  result: DmmApiResult | null;
  items: unknown[] | null;
  actresses: DmmActress[];
  diagnostic: StageDiagnostic;
};

type DmmSearchFailure = {
  success: false;
  status: number;
  error: { code: string; message: string };
  diagnostics?: DmmSearchDiagnostics;
};

export type DmmSearchOutcome = DmmSearchFailure | {
  success: true;
  items: unknown[];
  result: { items: unknown[] };
  meta: { searchMode: "keyword" | "cid" | "actress"; totalCount: number };
  diagnostics: DmmSearchDiagnostics;
};

type DmmSearchLogger = Pick<Console, "info" | "error">;
type DmmSearchRequest = { keyword: string; normalizedKeyword: string; cid: string | undefined };

function emptyStage(): StageDiagnostic {
  return {
    httpStatus: null,
    logicalStatus: null,
    logicalCode: null,
    totalCount: null,
    itemsLength: null,
    responseShape: "unavailable",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asDmmResult(value: unknown): DmmApiResult | null {
  return isRecord(value) ? (value as DmmApiResult) : null;
}

function asCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function asPublicId(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  return null;
}

function isSuccessfulResult(result: DmmApiResult) {
  const status = result.status === undefined ? null : String(result.status);
  const code = result.code === undefined ? null : String(result.code);
  return (
    (status === null || status === "200") &&
    (code === null || code === "0" || code === "200")
  );
}

function normalizeItems(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.item)) return value.item;
  return null;
}

function normalizeActresses(value: unknown): DmmActress[] | null {
  const actresses = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.item)
      ? value.item
      : null;
  if (!actresses || !actresses.every(isRecord)) return null;
  return actresses as DmmActress[];
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function searchRequestFor(requestUrl: string): DmmSearchRequest {
  const searchParams = new URL(requestUrl).searchParams;
  const keyword = (searchParams.get("keyword") ?? "素人").trim() || "素人";
  return {
    keyword,
    normalizedKeyword: normalizeSearchText(keyword),
    cid: searchParams.get("cid")?.trim(),
  };
}

function failure(
  code: string,
  message: string,
  diagnostics: DmmSearchDiagnostics,
): DmmSearchFailure {
  return { success: false, status: 502, error: { code, message }, diagnostics };
}

function validateItemsCall(
  call: DmmCall,
  diagnostics: DmmSearchDiagnostics,
  invalidResultMessage: string,
): DmmSearchFailure | null {
  if (!call.response.ok) {
    return failure(
      "DMM_API_HTTP_ERROR",
      "DMM APIがエラーを返しました。時間をおいて再試行してください。",
      diagnostics,
    );
  }
  if (!call.result || !isSuccessfulResult(call.result)) {
    return failure("DMM_API_ERROR", invalidResultMessage, diagnostics);
  }
  if (!call.items) {
    return failure(
      "DMM_API_INVALID_ITEMS",
      "DMM APIの検索結果形式が不正です。",
      diagnostics,
    );
  }
  return null;
}

function validateActressCall(
  call: DmmCall,
  diagnostics: DmmSearchDiagnostics,
): DmmSearchFailure | null {
  if (!call.response.ok) {
    return failure(
      "DMM_API_HTTP_ERROR",
      "DMM APIがエラーを返しました。時間をおいて再試行してください。",
      diagnostics,
    );
  }
  if (!call.result || !isSuccessfulResult(call.result)) {
    return failure(
      "DMM_API_ERROR",
      "DMM APIが女優検索を処理できませんでした。設定や検索条件を確認してください。",
      diagnostics,
    );
  }
  if (call.diagnostic.responseShape !== "valid") {
    return failure(
      "DMM_API_INVALID_RESPONSE",
      "DMM APIの女優検索結果形式が不正です。",
      diagnostics,
    );
  }
  return null;
}

function findExactActresses(actresses: DmmActress[], normalizedKeyword: string) {
  return actresses
    .map((actress) => ({
      name: typeof actress.name === "string" ? actress.name : "",
      actress_id: asPublicId(actress.actress_id ?? actress.id),
    }))
    .filter(
      (actress): actress is { name: string; actress_id: string } =>
        Boolean(actress.actress_id) &&
        normalizeSearchText(actress.name) === normalizedKeyword,
    );
}

function createDiagnostics(keyword: string): DmmSearchDiagnostics {
  return {
    requestedKeyword: keyword,
    primary: emptyStage(),
    actressSearch: {
      ...emptyStage(),
      attempted: false,
      returnedCount: 0,
      exactMatchCount: 0,
      exactMatches: [],
    },
    actressFallback: {
      ...emptyStage(),
      attempted: false,
      selectedActressId: null,
    },
    finalSource: "none",
    normalizedFinalItemsLength: 0,
  };
}

function createDmmCaller(
  apiId: string,
  affiliateId: string,
  keyword: string,
  fetcher: typeof fetch,
  logger: DmmSearchLogger,
) {
  return async function callDmmApi(
    endpoint: "ItemList" | "ActressSearch",
    params: URLSearchParams,
  ): Promise<DmmCall> {
    params.set("api_id", apiId);
    params.set("affiliate_id", affiliateId);
    params.set("output", "json");

    const response = await fetcher(
      `https://api.dmm.com/affiliate/v3/${endpoint}?${params.toString()}`,
      { cache: "no-store" },
    );

    let data: DmmApiResponse | null = null;
    let responseShape: StageDiagnostic["responseShape"] = "invalid";
    try {
      const parsed: unknown = await response.json();
      if (isRecord(parsed) && "result" in parsed) {
        data = parsed as DmmApiResponse;
        responseShape = "valid";
      }
    } catch {
      // Record an invalid response shape without exposing its body.
    }

    const result = asDmmResult(data?.result);
    const items = result ? normalizeItems(result.items) : null;
    const actresses = result ? normalizeActresses(result.actress) : null;
    const diagnostic = stageDiagnosticFor(response, result, items, actresses, responseShape);

    logger.info("DMM API diagnostic", {
      requestedKeyword: keyword,
      endpoint,
      httpStatus: diagnostic.httpStatus,
      logicalStatus: diagnostic.logicalStatus,
      logicalCode: diagnostic.logicalCode,
      totalCount: diagnostic.totalCount,
      itemsLength: diagnostic.itemsLength,
      responseShape: diagnostic.responseShape,
    });

    return { response, result, items, actresses: actresses ?? [], diagnostic };
  };
}

function stageDiagnosticFor(
  response: Response,
  result: DmmApiResult | null,
  items: unknown[] | null,
  actresses: DmmActress[] | null,
  responseShape: StageDiagnostic["responseShape"],
): StageDiagnostic {
  return {
    httpStatus: response.status,
    logicalStatus: result?.status === undefined ? null : String(result.status),
    logicalCode: result?.code === undefined ? null : String(result.code),
    totalCount: asCount(result?.total_count),
    itemsLength: items?.length ?? actresses?.length ?? null,
    responseShape: responseShape === "valid" && result ? "valid" : "invalid",
  };
}

async function fetchPrimaryItemCall(
  callDmmApi: ReturnType<typeof createDmmCaller>,
  keyword: string,
  cid: string | undefined,
  diagnostics: DmmSearchDiagnostics,
  logger: DmmSearchLogger,
): Promise<DmmCall | DmmSearchFailure> {
  try {
    const params = new URLSearchParams({ site: "FANZA", service: "digital", floor: "videoa", hits: "100" });
    if (cid) params.set("cid", cid);
    else params.set("keyword", keyword);
    return await callDmmApi("ItemList", params);
  } catch (error) {
    logger.error("DMM API network error", error instanceof Error ? error.message : "unknown");
    return failure(
      "DMM_API_NETWORK_ERROR",
      "DMM APIに接続できませんでした。時間をおいて再試行してください。",
      diagnostics,
    );
  }
}

function finalSourceFor(searchMode: "keyword" | "cid" | "actress", finalItems: unknown[]) {
  return searchMode === "actress" ? "actress" : finalItems.length > 0 ? "keyword" : "none";
}

type ActressFallback = {
  finalItems: unknown[];
  totalCount: number;
  searchMode: "keyword" | "actress";
};

async function searchByExactActress(input: {
  callDmmApi: ReturnType<typeof createDmmCaller>;
  diagnostics: DmmSearchDiagnostics;
  keyword: string;
  normalizedKeyword: string;
  initialItems: unknown[];
  initialTotalCount: number;
  logger: DmmSearchLogger;
}): Promise<ActressFallback | DmmSearchFailure> {
  const { callDmmApi, diagnostics, keyword, normalizedKeyword, initialItems, initialTotalCount, logger } = input;
  diagnostics.actressSearch.attempted = true;
  try {
    const actressCall = await callDmmApi(
      "ActressSearch",
      new URLSearchParams({ keyword, hits: "20", offset: "1", sort: "name" }),
    );
    diagnostics.actressSearch = {
      ...diagnostics.actressSearch,
      ...actressCall.diagnostic,
      attempted: true,
      returnedCount: actressCall.actresses.length,
      exactMatchCount: 0,
      exactMatches: [],
    };

    const actressError = validateActressCall(actressCall, diagnostics);
    if (actressError) return actressError;

    const exactMatches = findExactActresses(actressCall.actresses, normalizedKeyword);
    diagnostics.actressSearch.exactMatchCount = exactMatches.length;
    diagnostics.actressSearch.exactMatches = exactMatches;
    if (exactMatches.length !== 1) {
      return { finalItems: initialItems, totalCount: initialTotalCount, searchMode: "keyword" };
    }

    const actressId = exactMatches[0].actress_id;
    diagnostics.actressFallback.attempted = true;
    diagnostics.actressFallback.selectedActressId = actressId;
    const filteredCall = await callDmmApi(
      "ItemList",
      new URLSearchParams({
        site: "FANZA",
        service: "digital",
        floor: "videoa",
        article: "actress",
        article_id: actressId,
        hits: "100",
      }),
    );
    diagnostics.actressFallback = {
      ...diagnostics.actressFallback,
      ...filteredCall.diagnostic,
      attempted: true,
      selectedActressId: actressId,
    };

    const itemError = validateItemsCall(
      filteredCall,
      diagnostics,
      "DMM APIが女優作品検索を処理できませんでした。設定や検索条件を確認してください。",
    );
    if (itemError) return itemError;

    return {
      finalItems: filteredCall.items!,
      totalCount: asCount(filteredCall.result?.total_count) ?? filteredCall.items!.length,
      searchMode: "actress",
    };
  } catch (error) {
    logger.error("DMM actress fallback network error", error instanceof Error ? error.message : "unknown");
    return failure(
      "DMM_API_NETWORK_ERROR",
      "DMM APIに接続できませんでした。時間をおいて再試行してください。",
      diagnostics,
    );
  }
}

export async function searchDmmAffiliate(input: {
  apiId: string;
  affiliateId: string;
  requestUrl: string;
  fetcher?: typeof fetch;
  logger?: DmmSearchLogger;
}): Promise<DmmSearchOutcome> {
  const { apiId, affiliateId } = input;
  const fetcher = input.fetcher ?? fetch;
  const logger = input.logger ?? console;
  const { keyword, normalizedKeyword, cid } = searchRequestFor(input.requestUrl);
  const diagnostics = createDiagnostics(keyword);
  const callDmmApi = createDmmCaller(apiId, affiliateId, keyword, fetcher, logger);

  const primaryCall = await fetchPrimaryItemCall(callDmmApi, keyword, cid, diagnostics, logger);
  if ("success" in primaryCall) return primaryCall;
  const itemCall = primaryCall;

  diagnostics.primary = { ...itemCall.diagnostic };
  const primaryError = validateItemsCall(
    itemCall,
    diagnostics,
    "DMM APIが検索を処理できませんでした。設定や検索条件を確認してください。",
  );
  if (primaryError) return primaryError;

  let finalItems = itemCall.items!;
  let searchMode: "keyword" | "cid" | "actress" = cid ? "cid" : "keyword";
  let totalCount = asCount(itemCall.result?.total_count) ?? finalItems.length;

  if (!cid && finalItems.length === 0) {
    const actressFallback = await searchByExactActress({
      callDmmApi,
      diagnostics,
      keyword,
      normalizedKeyword,
      initialItems: finalItems,
      initialTotalCount: totalCount,
      logger,
    });
    if ("success" in actressFallback) return actressFallback;
    finalItems = actressFallback.finalItems;
    totalCount = actressFallback.totalCount;
    searchMode = actressFallback.searchMode;
  }

  diagnostics.finalSource = finalSourceFor(searchMode, finalItems);
  diagnostics.normalizedFinalItemsLength = finalItems.length;
  logger.info("DMM search diagnostics", diagnostics);
  return {
    success: true,
    items: finalItems,
    result: { items: finalItems },
    meta: { searchMode, totalCount },
    diagnostics,
  };
}
