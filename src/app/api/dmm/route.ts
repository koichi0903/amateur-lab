import { NextResponse } from "next/server";

type DmmApiResult = {
  status?: number | string;
  code?: number | string;
  message?: string;
  items?: unknown;
  actress?: unknown;
  total_count?: number;
  result_count?: number;
};
type DmmApiResponse = { result?: DmmApiResult };

type DmmActress = { id?: number | string; name?: string };

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
  if (
    typeof value === "object" &&
    value !== null &&
    "item" in value &&
    Array.isArray(value.item)
  ) {
    return value.item;
  }
  return null;
}

function normalizeActresses(value: unknown): DmmActress[] {
  if (Array.isArray(value)) return value as DmmActress[];
  if (
    typeof value === "object" &&
    value !== null &&
    "item" in value &&
    Array.isArray(value.item)
  ) {
    return value.item as DmmActress[];
  }
  return [];
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
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
  const keyword = searchParams.get("keyword")?.trim() || "素人";
  const cid = searchParams.get("cid")?.trim();
  async function callDmmApi(endpoint: "ItemList" | "ActressSearch", params: URLSearchParams) {
    params.set("api_id", apiId!);
    params.set("affiliate_id", affiliateId!);
    params.set("output", "json");

    const response = await fetch(
      `https://api.dmm.com/affiliate/v3/${endpoint}?${params.toString()}`,
      { cache: "no-store" },
    );

    let data: DmmApiResponse | null = null;
    try {
      data = (await response.json()) as DmmApiResponse;
    } catch {
      // The caller reports this as an invalid upstream response below.
    }

    const result = data?.result;
    const resultKeys =
      result && typeof result === "object" ? Object.keys(result) : [];
    const items = result ? normalizeItems(result.items) : null;
    console.info("DMM API response", {
      endpoint,
      httpStatus: response.status,
      topLevelKeys: data ? Object.keys(data) : [],
      resultKeys,
      status: result?.status,
      code: result?.code,
      message: result?.message,
      totalCount: result?.total_count,
      resultCount: result?.result_count,
      itemsLength: items?.length ?? null,
    });

    return { response, data, result, items };
  }

  let itemCall: Awaited<ReturnType<typeof callDmmApi>>;
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
    return errorResponse(502, "DMM_API_NETWORK_ERROR", "DMM APIに接続できませんでした。時間をおいて再試行してください。");
  }

  const { response, result, items } = itemCall;
  if (!response.ok) {
    return errorResponse(502, "DMM_API_HTTP_ERROR", "DMM APIがエラーを返しました。時間をおいて再試行してください。");
  }
  if (!result || !isSuccessfulResult(result)) {
    return errorResponse(502, "DMM_API_ERROR", "DMM APIが検索を処理できませんでした。設定や検索条件を確認してください。");
  }
  if (!items) {
    return errorResponse(502, "DMM_API_INVALID_ITEMS", "DMM APIの検索結果形式が不正です。");
  }

  let finalItems = items;
  let searchMode: "keyword" | "cid" | "actress" = cid ? "cid" : "keyword";
  let totalCount = result.total_count ?? items.length;

  // DMM's item keyword search does not reliably resolve a performer name.
  // Resolve an exact actress name first, then use the documented ItemList
  // actress filter while preserving normal free-text search behavior.
  if (!cid && items.length === 0) {
    try {
      const actressCall = await callDmmApi(
        "ActressSearch",
        new URLSearchParams({ keyword, hits: "20", offset: "1", sort: "name" }),
      );
      if (!actressCall.response.ok) {
        return errorResponse(502, "DMM_API_HTTP_ERROR", "DMM APIがエラーを返しました。時間をおいて再試行してください。");
      }
      if (!actressCall.result || !isSuccessfulResult(actressCall.result)) {
        return errorResponse(502, "DMM_API_ERROR", "DMM APIが女優検索を処理できませんでした。設定や検索条件を確認してください。");
      }

      const actresses = normalizeActresses(actressCall.result.actress);
      const exactMatches = actresses.filter(
        (actress) => actress.name?.trim() === keyword,
      );
      const actressIds = exactMatches
        .map((actress) => String(actress.id ?? "").trim())
        .filter(Boolean)
        .slice(0, 5);

      if (actressIds.length > 0) {
        const filteredCalls = await Promise.all(
          actressIds.map((actressId) =>
            callDmmApi(
              "ItemList",
              new URLSearchParams({
                site: "FANZA",
                service: "digital",
                floor: "videoa",
                article: "actress",
                article_id: actressId,
                hits: "100",
              }),
            ),
          ),
        );
        const invalidCall = filteredCalls.find(
          (call) => !call.response.ok || !call.result || !isSuccessfulResult(call.result) || !call.items,
        );
        if (invalidCall) {
          return errorResponse(502, "DMM_API_ERROR", "DMM APIが女優作品検索を処理できませんでした。設定や検索条件を確認してください。");
        }
        finalItems = filteredCalls.flatMap((call) => call.items ?? []);
        totalCount = filteredCalls.reduce(
          (sum, call) => sum + (call.result?.total_count ?? call.items?.length ?? 0),
          0,
        );
        searchMode = "actress";
      }
    } catch (error) {
      console.error("DMM actress fallback network error", error instanceof Error ? error.message : "unknown");
      return errorResponse(502, "DMM_API_NETWORK_ERROR", "DMM APIに接続できませんでした。時間をおいて再試行してください。");
    }
  }

  return NextResponse.json({
    success: true,
    items: finalItems,
    result: { items: finalItems },
    meta: { searchMode, totalCount },
  });
}
