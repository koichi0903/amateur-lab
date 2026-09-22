import { NextResponse } from "next/server";

type DmmApiResult = {
  status?: number | string;
  code?: number | string;
  message?: string;
  items?: unknown;
  actress?: unknown;
  total_count?: number | string;
  result_count?: number | string;
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

type SearchDiagnostics = {
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
  data: DmmApiResponse | null;
  result: DmmApiResult | null;
  items: unknown[] | null;
  actresses: DmmActress[];
  diagnostic: StageDiagnostic;
};

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

function errorResponse(
  status: number,
  code: string,
  message: string,
  diagnostics?: SearchDiagnostics,
) {
  return NextResponse.json(
    { success: false, error: { code, message }, ...(diagnostics ? { diagnostics } : {}) },
    { status },
  );
}

export async function GET(request: Request) {
  const apiId = process.env.DMM_API_ID?.trim();
  const affiliateId = process.env.DMM_AFFILIATE_ID?.trim();

  if (!apiId || !affiliateId) {
    return errorResponse(
      503,
      "DMM_API_NOT_CONFIGURED",
      "DMM APIの設定がありません。管理者に確認してください。",
    );
  }

  const { searchParams } = new URL(request.url);
  const rawKeyword = searchParams.get("keyword") ?? "素人";
  const keyword = rawKeyword.trim() || "素人";
  const normalizedKeyword = normalizeSearchText(keyword);
  const cid = searchParams.get("cid")?.trim();

  const diagnostics: SearchDiagnostics = {
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

  async function callDmmApi(
    endpoint: "ItemList" | "ActressSearch",
    params: URLSearchParams,
  ): Promise<DmmCall> {
    params.set("api_id", apiId!);
    params.set("affiliate_id", affiliateId!);
    params.set("output", "json");

    const response = await fetch(
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
      // The diagnostic records an invalid response without exposing its body.
    }

    const result = asDmmResult(data?.result);
    const items = result ? normalizeItems(result.items) : null;
    const actresses = result ? normalizeActresses(result.actress) : null;
    const diagnostic: StageDiagnostic = {
      httpStatus: response.status,
      logicalStatus:
        result?.status === undefined ? null : String(result.status),
      logicalCode: result?.code === undefined ? null : String(result.code),
      totalCount: asCount(result?.total_count),
      itemsLength: items?.length ?? (actresses?.length ?? null),
      responseShape:
        responseShape === "valid" && result ? "valid" : "invalid",
    };

    console.info("DMM API diagnostic", {
      requestedKeyword: keyword,
      endpoint,
      httpStatus: diagnostic.httpStatus,
      logicalStatus: diagnostic.logicalStatus,
      logicalCode: diagnostic.logicalCode,
      totalCount: diagnostic.totalCount,
      itemsLength: diagnostic.itemsLength,
      responseShape: diagnostic.responseShape,
    });

    return {
      response,
      data,
      result,
      items,
      actresses: actresses ?? [],
      diagnostic,
    };
  }

  let itemCall: DmmCall;
  try {
    const params = new URLSearchParams({
      site: "FANZA",
      service: "digital",
      floor: "videoa",
      hits: "100",
    });
    if (cid) params.set("cid", cid);
    else params.set("keyword", keyword);
    itemCall = await callDmmApi("ItemList", params);
  } catch (error) {
    console.error("DMM API network error", error instanceof Error ? error.message : "unknown");
    return errorResponse(502, "DMM_API_NETWORK_ERROR", "DMM APIに接続できませんでした。時間をおいて再試行してください。", diagnostics);
  }

  diagnostics.primary = { ...itemCall.diagnostic };
  const { response, result, items } = itemCall;
  if (!response.ok) {
    return errorResponse(502, "DMM_API_HTTP_ERROR", "DMM APIがエラーを返しました。時間をおいて再試行してください。", diagnostics);
  }
  if (!result || !isSuccessfulResult(result)) {
    return errorResponse(502, "DMM_API_ERROR", "DMM APIが検索を処理できませんでした。設定や検索条件を確認してください。", diagnostics);
  }
  if (!items) {
    return errorResponse(502, "DMM_API_INVALID_ITEMS", "DMM APIの検索結果形式が不正です。", diagnostics);
  }

  let finalItems = items;
  let searchMode: "keyword" | "cid" | "actress" = cid ? "cid" : "keyword";
  let totalCount = asCount(result.total_count) ?? items.length;

  if (!cid && items.length === 0) {
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

      if (!actressCall.response.ok) {
        return errorResponse(502, "DMM_API_HTTP_ERROR", "DMM APIがエラーを返しました。時間をおいて再試行してください。", diagnostics);
      }
      if (!actressCall.result || !isSuccessfulResult(actressCall.result)) {
        return errorResponse(502, "DMM_API_ERROR", "DMM APIが女優検索を処理できませんでした。設定や検索条件を確認してください。", diagnostics);
      }
      if (actressCall.diagnostic.responseShape !== "valid") {
        return errorResponse(502, "DMM_API_INVALID_RESPONSE", "DMM APIの女優検索結果形式が不正です。", diagnostics);
      }

      const exactMatches = actressCall.actresses
        .map((actress) => ({
          name: typeof actress.name === "string" ? actress.name : "",
          actress_id: asPublicId(actress.actress_id ?? actress.id),
        }))
        .filter(
          (actress): actress is { name: string; actress_id: string } =>
            Boolean(actress.actress_id) &&
            normalizeSearchText(actress.name) === normalizedKeyword,
        );
      diagnostics.actressSearch.exactMatchCount = exactMatches.length;
      diagnostics.actressSearch.exactMatches = exactMatches;

      // Do not choose an actress when DMM returns multiple exact candidates.
      if (exactMatches.length === 1) {
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
        if (!filteredCall.response.ok) {
          return errorResponse(502, "DMM_API_HTTP_ERROR", "DMM APIがエラーを返しました。時間をおいて再試行してください。", diagnostics);
        }
        if (!filteredCall.result || !isSuccessfulResult(filteredCall.result)) {
          return errorResponse(502, "DMM_API_ERROR", "DMM APIが女優作品検索を処理できませんでした。設定や検索条件を確認してください。", diagnostics);
        }
        if (!filteredCall.items) {
          return errorResponse(502, "DMM_API_INVALID_ITEMS", "DMM APIの女優作品検索結果形式が不正です。", diagnostics);
        }
        finalItems = filteredCall.items;
        totalCount = asCount(filteredCall.result.total_count) ?? filteredCall.items.length;
        searchMode = "actress";
      }
    } catch (error) {
      console.error("DMM actress fallback network error", error instanceof Error ? error.message : "unknown");
      return errorResponse(502, "DMM_API_NETWORK_ERROR", "DMM APIに接続できませんでした。時間をおいて再試行してください。", diagnostics);
    }
  }

  diagnostics.finalSource = searchMode === "actress" ? "actress" : finalItems.length > 0 ? "keyword" : "none";
  diagnostics.normalizedFinalItemsLength = finalItems.length;
  console.info("DMM search diagnostics", diagnostics);

  return NextResponse.json({
    success: true,
    items: finalItems,
    result: { items: finalItems },
    meta: { searchMode, totalCount },
    diagnostics,
  });
}
