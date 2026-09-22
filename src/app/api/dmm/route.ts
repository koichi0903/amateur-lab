import { NextResponse } from "next/server";

type DmmApiResult = { status?: number; items?: unknown };
type DmmApiResponse = { result?: DmmApiResult };

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
  const url =
    "https://api.dmm.com/affiliate/v3/ItemList" +
    `?api_id=${encodeURIComponent(apiId)}` +
    `&affiliate_id=${encodeURIComponent(affiliateId)}` +
    "&site=FANZA" +
    "&service=digital" +
    "&floor=videoa" +
    (cid ? `&cid=${encodeURIComponent(cid)}` : `&keyword=${encodeURIComponent(keyword)}`) +
    "&hits=100" +
    "&output=json";

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    console.error("DMM API network error", error instanceof Error ? error.message : "unknown");
    return errorResponse(502, "DMM_API_NETWORK_ERROR", "DMM APIに接続できませんでした。時間をおいて再試行してください。");
  }

  if (!response.ok) {
    console.error("DMM API HTTP error", response.status);
    return errorResponse(502, "DMM_API_HTTP_ERROR", "DMM APIがエラーを返しました。時間をおいて再試行してください。");
  }

  let data: DmmApiResponse;
  try {
    data = (await response.json()) as DmmApiResponse;
  } catch (error) {
    console.error("DMM API JSON parse error", error instanceof Error ? error.message : "unknown");
    return errorResponse(502, "DMM_API_INVALID_JSON", "DMM APIの応答を解釈できませんでした。");
  }

  const result = data?.result;
  if (!result || typeof result !== "object") {
    console.error("DMM API response missing result");
    return errorResponse(502, "DMM_API_INVALID_RESPONSE", "DMM APIの応答形式が不正です。");
  }
  if (result.status !== undefined && result.status !== 200) {
    console.error("DMM API application error", result.status);
    return errorResponse(502, "DMM_API_ERROR", "DMM APIが検索を処理できませんでした。設定や検索条件を確認してください。");
  }
  if (!Array.isArray(result.items)) {
    console.error("DMM API response items is not an array");
    return errorResponse(502, "DMM_API_INVALID_ITEMS", "DMM APIの検索結果形式が不正です。");
  }

  return NextResponse.json({
    success: true,
    items: result.items,
    result: { items: result.items },
  });
}
