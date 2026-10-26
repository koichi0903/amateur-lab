import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/requestAuth";
import { getGoogleAccessToken } from "@/lib/googleAcquisitionAnalytics";

export const runtime = "nodejs";
export const maxDuration = 300;

const SEARCH_CONSOLE_SITE_URL =
  process.env.SEARCH_CONSOLE_SITE_URL ?? "sc-domain:hakkutsu-lab.com";
const URL_INSPECTION_ENDPOINT =
  "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const MAX_URLS_PER_REQUEST = 635;
const CONCURRENCY = 5;
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type InspectionResult = {
  inspectionResultLink?: string;
  indexStatusResult?: {
    verdict?: string;
    coverageState?: string;
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
    sitemap?: string[];
    referringUrls?: string[];
  };
};

type InspectionRow = {
  url: string;
  status: "ok" | "error";
  inspection?: InspectionResult;
  error?: string;
  stopBatch?: boolean;
};

function normalizeActressUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "hakkutsu-lab.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith("/actress/") ||
      url.pathname.slice("/actress/".length).length === 0 ||
      url.pathname.slice("/actress/".length).includes("/")
    ) return null;

    return url.toString();
  } catch {
    return null;
  }
}

function safeGoogleError(status: number) {
  if (status === 403) {
    return "Googleが拒否しました。Search Consoleプロパティへのサービスアカウント共有とAPI有効化を確認してください。";
  }
  if (status === 429) return "Google APIの利用上限に達しました。時間をおいて残りを再実行してください。";
  return `Google URL Inspection APIエラー（HTTP ${status}）。`;
}

async function inspectOne(url: string, token: string): Promise<InspectionRow> {
  try {
    const response = await fetch(URL_INSPECTION_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: SEARCH_CONSOLE_SITE_URL,
        languageCode: "ja-JP",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        url,
        status: "error",
        error: safeGoogleError(response.status),
        stopBatch: response.status === 403 || response.status === 429,
      };
    }

    const body = await response.json() as { inspectionResult?: InspectionResult };
    if (!body.inspectionResult) {
      return { url, status: "error", error: "Google API応答に検査結果がありません。" };
    }
    return { url, status: "ok", inspection: body.inspectionResult };
  } catch {
    return { url, status: "error", error: "Google URL Inspection APIへの接続に失敗しました。" };
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON形式のリクエストが必要です。" }, { status: 400 });
  }

  const urls = (body as { urls?: unknown } | null)?.urls;
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_URLS_PER_REQUEST) {
    return NextResponse.json(
      { error: `urlsには1〜${MAX_URLS_PER_REQUEST}件を指定してください。` },
      { status: 400 },
    );
  }

  const normalizedUrls = urls.map(normalizeActressUrl);
  if (normalizedUrls.some((url) => !url)) {
    return NextResponse.json(
      { error: "https://hakkutsu-lab.com/actress/{slug} のURLだけを指定できます。" },
      { status: 400 },
    );
  }
  const safeUrls = normalizedUrls as string[];
  if (new Set(safeUrls).size !== safeUrls.length) {
    return NextResponse.json({ error: "URLの重複は指定できません。" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getGoogleAccessToken(SEARCH_CONSOLE_SCOPE);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google認証に失敗しました。";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const results: InspectionRow[] = [];
  let stoppedEarly = false;
  for (let offset = 0; offset < safeUrls.length; offset += CONCURRENCY) {
    const chunk = safeUrls.slice(offset, offset + CONCURRENCY);
    const inspectedChunk = await Promise.all(chunk.map((url) => inspectOne(url, token)));
    results.push(...inspectedChunk);
    if (inspectedChunk.some((row) => row.stopBatch)) {
      stoppedEarly = offset + chunk.length < safeUrls.length;
      break;
    }
  }

  return NextResponse.json(
    {
      source: "google-index-snapshot",
      checkedAt: new Date().toISOString(),
      requested: safeUrls.length,
      attempted: results.length,
      succeeded: results.filter((row) => row.status === "ok").length,
      failed: results.filter((row) => row.status === "error").length,
      unprocessed: safeUrls.length - results.length,
      stoppedEarly,
      results,
    },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
