import type { DmmActressProfile } from "@/types/dmm";

const DMM_REQUEST_TIMEOUT_MS = 30_000;
const DMM_MAX_ATTEMPTS = 3;

export type DmmActressApiResult = {
  status?: string | number;
  actress?: DmmActressProfile[];
  total_count?: string | number;
};

type FetchPage = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

async function fetchActressApiResponse(
  url: string,
  fetchPage: FetchPage,
  sleep: Sleep,
): Promise<Response> {
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= DMM_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DMM_REQUEST_TIMEOUT_MS);
    try {
      response = await fetchPage(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok || (response.status < 400 && response.status !== 429)) break;
      lastError = new Error(`DMM女優APIがHTTP ${response.status}を返しました。`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < DMM_MAX_ATTEMPTS) await sleep(attempt * 1000);
  }

  if (!response) throw lastError instanceof Error ? lastError : new Error("DMM女優APIへの接続に失敗しました。");
  return response;
}

async function readActressApiResult(response: Response): Promise<DmmActressApiResult> {
  if (!response.ok) throw new Error(`DMM女優APIがHTTP ${response.status}を返しました。`);

  const payload = (await response.json()) as { result?: DmmActressApiResult };
  const result = payload.result;
  if (!result || String(result.status ?? "200") !== "200") {
    throw new Error("DMM女優APIの応答が不正です。");
  }
  return result;
}

export async function fetchDmmActressProfiles(
  url: string,
  dependencies: {
    fetch?: typeof fetch;
    sleep?: Sleep;
  } = {},
): Promise<DmmActressApiResult> {
  const fetchPage = dependencies.fetch ?? fetch;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const response = await fetchActressApiResponse(url, fetchPage, sleep);
  return readActressApiResult(response);
}
