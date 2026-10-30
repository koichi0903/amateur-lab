import { getFanzaAmateurAffiliateId } from "@/lib/dmm/fanzaAmateurAffiliate";
import { FANZA_AMATEUR_FLOOR } from "@/lib/dmm/fanzaAmateurCatalogConstants";

const API_ROOT = "https://api.dmm.com/affiliate/v3/ItemList";

export type FanzaAmateurApiItemListRange = { fromDate: string; toDate: string };
export type FanzaAmateurApiItemListPayload = {
  result?: {
    status?: number | string;
    total_count?: number | string;
    result_count?: number | string;
    items?: unknown;
  };
};
type FanzaAmateurApiHttpResponse = Pick<Response, "ok" | "status" | "json">;
type FanzaAmateurApiFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<FanzaAmateurApiHttpResponse>;

export type FanzaAmateurApiItemListRequest = {
  offset: number;
  hits: number;
  sort: "date" | "rank";
  range?: FanzaAmateurApiItemListRange;
};

export function safeFanzaAmateurApiError(responseStatus: number, payload: FanzaAmateurApiItemListPayload) {
  return `DMM APIの取得に失敗しました（HTTP ${responseStatus} / API ${String(payload.result?.status ?? responseStatus)}）。`;
}

export async function fetchFanzaAmateurApiItemListPage(
  request: FanzaAmateurApiItemListRequest,
  dependencies: {
    apiId?: string | null;
    affiliateId?: string;
    fetcher?: FanzaAmateurApiFetcher;
  } = {},
) {
  const apiId = (dependencies.apiId ?? process.env.DMM_API_ID)?.trim();
  if (!apiId) throw new Error("DMM API IDが設定されていません。");

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: dependencies.affiliateId ?? getFanzaAmateurAffiliateId(),
    site: "FANZA",
    service: "digital",
    floor: FANZA_AMATEUR_FLOOR,
    hits: String(request.hits),
    offset: String(request.offset),
    sort: request.sort,
    output: "json",
  });
  if (request.range) {
    params.set("gte_date", `${request.range.fromDate}T00:00:00`);
    params.set("lte_date", `${request.range.toDate}T23:59:59`);
  }

  const fetcher = dependencies.fetcher ?? fetch;
  const response = await fetcher(`${API_ROOT}?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as FanzaAmateurApiItemListPayload;
  return { response, payload, rawItems: payload.result?.items };
}
