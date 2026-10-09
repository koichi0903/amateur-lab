import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? "550830948";
const SEARCH_CONSOLE_SITE_URL =
  process.env.SEARCH_CONSOLE_SITE_URL ?? "sc-domain:hakkutsu-lab.com";

type GoogleCredential = {
  email: string;
  privateKey: string;
};

type GoogleAccessToken = {
  value: string;
  expiresAt: number;
};

type SearchConsoleDailyRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type AnalyticsDataRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type DailyMetric = {
  date: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  activeUsers?: number;
  sessions?: number;
  pageViews?: number;
};

export type GoogleAcquisitionAnalytics = {
  configured: boolean;
  period: { startDate: string; endDate: string };
  searchConsole: {
    available: boolean;
    error: string | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    averagePosition: number | null;
    daily: DailyMetric[];
  };
  analytics: {
    available: boolean;
    error: string | null;
    activeUsers: number | null;
    sessions: number | null;
    pageViews: number | null;
    daily: DailyMetric[];
  };
};

const cachedTokens = new Map<string, GoogleAccessToken>();

function getCredential(): GoogleCredential | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !privateKey) return null;
  return { email, privateKey: privateKey.replace(/\\n/g, "\n") };
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function createSignedAssertion(credential: GoogleCredential, scope: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    iss: credential.email,
    scope,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const content = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(content);
  signer.end();
  return `${content}.${signer.sign(credential.privateKey).toString("base64url")}`;
}

async function getAccessToken(scope: string) {
  const credential = getCredential();
  if (!credential) throw new Error("Google読み取り用サービスアカウントが未設定です。");

  const cacheKey = `${credential.email}:${scope}`;
  const cachedToken = cachedTokens.get(cacheKey);
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createSignedAssertion(credential, scope),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google認証に失敗しました（${response.status}）。`);
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error("Google認証からアクセストークンを取得できませんでした。");

  cachedTokens.set(cacheKey, {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  });
  return result.access_token;
}

function jstDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function shiftDayKey(dayKey: string, amount: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return shifted.toISOString().slice(0, 10);
}

function reportPeriod() {
  const endDate = shiftDayKey(jstDayKey(new Date()), -3);
  return { startDate: shiftDayKey(endDate, -27), endDate };
}

function emptyReport(period: { startDate: string; endDate: string }): GoogleAcquisitionAnalytics {
  return {
    configured: Boolean(getCredential()),
    period,
    searchConsole: {
      available: false,
      error: null,
      clicks: null,
      impressions: null,
      ctr: null,
      averagePosition: null,
      daily: [],
    },
    analytics: {
      available: false,
      error: null,
      activeUsers: null,
      sessions: null,
      pageViews: null,
      daily: [],
    },
  };
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Googleレポートを取得できませんでした。";
}

async function fetchSearchConsoleReport(
  period: { startDate: string; endDate: string },
): Promise<GoogleAcquisitionAnalytics["searchConsole"]> {
  const token = await getAccessToken(SEARCH_CONSOLE_SCOPE);
  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SEARCH_CONSOLE_SITE_URL)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...period,
        dimensions: ["date"],
        type: "web",
        rowLimit: 25000,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const message = response.status === 403
      ? "サービスアカウントのSearch Console読み取り権限、またはSearch Console APIの有効化を確認してください。"
      : `Search Consoleレポートを取得できませんでした（${response.status}）。`;
    throw new Error(message);
  }
  const result = await response.json() as { rows?: SearchConsoleDailyRow[] };
  const daily = (result.rows ?? []).map((row) => ({
    date: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  })).filter((row) => row.date);
  const impressions = daily.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
  const clicks = daily.reduce((sum, row) => sum + (row.clicks ?? 0), 0);
  const weightedPosition = daily.reduce(
    (sum, row) => sum + (row.position ?? 0) * (row.impressions ?? 0),
    0,
  );

  return {
    available: true,
    error: null,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    averagePosition: impressions > 0 ? weightedPosition / impressions : 0,
    daily,
  };
}

async function fetchAnalyticsReport(
  period: { startDate: string; endDate: string },
): Promise<GoogleAcquisitionAnalytics["analytics"]> {
  const token = await getAccessToken(GA4_SCOPE);
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(GA4_PROPERTY_ID)}:runReport`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const [summaryResponse, dailyResponse] = await Promise.all([
    fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dateRanges: [period],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
      }),
      cache: "no-store",
    }),
    fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dateRanges: [period],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: "40",
      }),
      cache: "no-store",
    }),
  ]);
  if (!summaryResponse.ok) {
    const message = summaryResponse.status === 403
      ? "サービスアカウントのGA4閲覧権限、またはGoogle Analytics Data APIの有効化を確認してください。"
      : `GA4集計レポートを取得できませんでした（${summaryResponse.status}）。`;
    throw new Error(message);
  }
  if (!dailyResponse.ok) {
    const message = dailyResponse.status === 403
      ? "サービスアカウントのGA4閲覧権限、またはGoogle Analytics Data APIの有効化を確認してください。"
      : `GA4日別レポートを取得できませんでした（${dailyResponse.status}）。`;
    throw new Error(message);
  }

  const summary = await summaryResponse.json() as { rows?: AnalyticsDataRow[] };
  const dailyResult = await dailyResponse.json() as { rows?: AnalyticsDataRow[] };
  const metricValue = (row: AnalyticsDataRow | undefined, index: number) => {
    const value = Number(row?.metricValues?.[index]?.value ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  const daily = (dailyResult.rows ?? []).map((row) => {
    const date = row.dimensionValues?.[0]?.value ?? "";
    return {
      date: date.length === 8
        ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
        : date,
      activeUsers: metricValue(row, 0),
      sessions: metricValue(row, 1),
      pageViews: metricValue(row, 2),
    };
  }).filter((row) => row.date);
  const row = summary.rows?.[0];

  return {
    available: true,
    error: null,
    activeUsers: metricValue(row, 0),
    sessions: metricValue(row, 1),
    pageViews: metricValue(row, 2),
    daily,
  };
}

export async function getGoogleAcquisitionAnalytics(): Promise<GoogleAcquisitionAnalytics> {
  const period = reportPeriod();
  const report = emptyReport(period);
  if (!report.configured) {
    report.searchConsole.error = "VercelにGoogle読み取り用サービスアカウントの設定が必要です。";
    report.analytics.error = "VercelにGoogle読み取り用サービスアカウントの設定が必要です。";
    return report;
  }

  const [searchResult, analyticsResult] = await Promise.allSettled([
    fetchSearchConsoleReport(period),
    fetchAnalyticsReport(period),
  ]);
  if (searchResult.status === "fulfilled") report.searchConsole = searchResult.value;
  else report.searchConsole.error = safeErrorMessage(searchResult.reason);
  if (analyticsResult.status === "fulfilled") report.analytics = analyticsResult.value;
  else report.analytics.error = safeErrorMessage(analyticsResult.reason);
  return report;
}
