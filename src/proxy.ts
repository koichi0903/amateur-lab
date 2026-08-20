import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API_PATHS = new Set([
  "/api/affiliate-click",
  "/api/affiliate-impression",
  "/api/compare",
  "/api/contact",
  "/api/favorites",
]);
const LOCAL_UPDATE_API_PATHS = new Set([
  "/api/admin/browser-health",
  "/api/admin/fill-sample-movie",
  "/api/admin/local-playwright-update",
  "/api/dmm-ranking",
  "/api/fanza-page",
  "/api/review-update",
  "/api/score-update",
  "/api/sync/update-stage",
  "/api/update-all",
  "/api/update-ended-sale",
  "/api/update-missing-prices",
  "/api/update-new",
  "/api/update-old",
  "/api/update-reserve",
  "/api/update-sale",
  "/api/update-semi-new",
]);
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;
const BOT_PATTERN =
  /bot|crawler|spider|crawling|preview|facebookexternalhit|twitterbot|slackbot|discordbot|line|whatsapp|telegram|pinterest|embedly|quora|vkshare|curl|wget|python-requests/i;
const WORK_DETAIL_PATH_PATTERN = /^\/works\/[^/]+$/;
const CATALOG_DETAIL_PATH_PATTERN = /^\/(?:actress|series|maker|genre)\/[^/]+$/;
const BOT_LIGHTWEIGHT_INDEX_PATHS = new Set([
  "/actress",
  "/genre",
  "/maker",
  "/ranking",
  "/sale",
  "/series",
]);

function secureCompare(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

function unauthorized(message = "Authentication required") {
  return new NextResponse(message, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Hakkutsu LAB Admin", charset="UTF-8"',
    },
  });
}

function unavailable() {
  return NextResponse.json(
    { error: "Server authentication is not configured" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function isBotRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get("user-agent") ?? "";
  return BOT_PATTERN.test(userAgent);
}

function lightweightWorkResponse(request: NextRequest) {
  const title = "発掘LAB | FANZA作品分析メディア";
  const description =
    "FANZA作品をレビュー・ランキング・セール情報から独自分析。";
  const url = request.nextUrl.href;
  const image = new URL("/ogp.png", request.url).href;
  const body = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="発掘LAB"><meta property="og:locale" content="ja_JP"><meta property="og:type" content="article"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}"><meta name="robots" content="noarchive"></head><body><a href="${url}">${title}</a></body></html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

function lightweightCatalogResponse(request: NextRequest) {
  const title = "発掘LAB | FANZA作品分析メディア";
  const description =
    "FANZA作品をレビュー・ランキング・セール情報から独自分析。";
  const url = request.nextUrl.href;
  const image = new URL("/ogp.png", request.url).href;
  const body = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="発掘LAB"><meta property="og:locale" content="ja_JP"><meta property="og:type" content="website"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}"><meta name="robots" content="noarchive"></head><body><a href="${url}">${title}</a></body></html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

function hasValidBasicAuth(request: NextRequest): boolean {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return false;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;

    return (
      secureCompare(decoded.slice(0, separator), username) &&
      secureCompare(decoded.slice(separator + 1), password)
    );
  } catch {
    return false;
  }
}

function hasValidCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || !authorization?.startsWith("Bearer ")) return false;

  return secureCompare(authorization.slice("Bearer ".length), cronSecret);
}

function adminCookieName(request: NextRequest): string {
  return request.nextUrl.protocol === "https:"
    ? "__Host-hakkutsu_admin"
    : "hakkutsu_admin";
}

async function adminSessionToken(): Promise<string | null> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const cronSecret = process.env.CRON_SECRET;
  if (!username || !password || !cronSecret) return null;

  const payload = new TextEncoder().encode(
    `hakkutsu-admin-session\0${username}\0${password}\0${cronSecret}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", payload);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hasValidAdminSession(request: NextRequest): Promise<boolean> {
  const expected = await adminSessionToken();
  const actual = request.cookies.get(adminCookieName(request))?.value;
  return Boolean(expected && actual && secureCompare(actual, expected));
}

async function authenticatedAdminResponse(request: NextRequest) {
  const token = await adminSessionToken();
  if (!token) return unavailable();

  const response = NextResponse.next();
  response.cookies.set(adminCookieName(request), token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLocalRequest = ["localhost", "127.0.0.1"].includes(
    request.nextUrl.hostname,
  );

  if (/^\/works\/[^/]+\/(?:opengraph-image|twitter-image)$/.test(pathname)) {
    return NextResponse.rewrite(new URL("/ogp.png", request.url));
  }

  if (WORK_DETAIL_PATH_PATTERN.test(pathname) && isBotRequest(request)) {
    return lightweightWorkResponse(request);
  }

  if (CATALOG_DETAIL_PATH_PATTERN.test(pathname) && isBotRequest(request)) {
    return lightweightCatalogResponse(request);
  }

  if (BOT_LIGHTWEIGHT_INDEX_PATHS.has(pathname) && isBotRequest(request)) {
    return lightweightCatalogResponse(request);
  }

  // The local admin UI is the control panel for update jobs that cannot run
  // reliably on Vercel (notably Playwright). Keep production admin routes
  // authenticated, while allowing the loopback-only development server.
  if (isLocalRequest && pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (isLocalRequest && pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  if (
    LOCAL_UPDATE_API_PATHS.has(pathname) &&
    isLocalRequest
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/api/admin/revalidate") {
    if (!process.env.CRON_SECRET) return unavailable();
    return hasValidCronSecret(request)
      ? NextResponse.next()
      : NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
  }

  if (pathname === "/api/cron") {
    if (!process.env.CRON_SECRET) return unavailable();
    return hasValidCronSecret(request)
      ? NextResponse.next()
      : NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
  }

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return unavailable();
  }

  if (hasValidBasicAuth(request)) {
    return authenticatedAdminResponse(request);
  }

  if (await hasValidAdminSession(request)) {
    return NextResponse.next();
  }

  return unauthorized();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/works/:id",
    "/actress/:name",
    "/actress",
    "/series/:name",
    "/series",
    "/maker/:name",
    "/maker",
    "/genre/:name",
    "/genre",
    "/ranking",
    "/sale",
    "/works/:id/opengraph-image",
    "/works/:id/twitter-image",
  ],
};
