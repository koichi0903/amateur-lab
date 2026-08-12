import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API_PATHS = new Set(["/api/favorites"]);

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
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

  return hasValidBasicAuth(request) ? NextResponse.next() : unauthorized();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
