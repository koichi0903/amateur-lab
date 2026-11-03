import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "hakkutsu_admin";
const LEGACY_ADMIN_SESSION_COOKIE = "__Host-hakkutsu_admin";

function same(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < actual.length; i += 1) result |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return result === 0;
}

async function sessionToken() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.CRON_SECRET;
  if (!username || !password || !secret) return null;
  const input = new TextEncoder().encode(`hakkutsu-admin-session\0${username}\0${password}\0${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isLocalDevelopmentRequest(request: NextRequest) {
  return (
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname)
  );
}

function hasValidBasicAuthorization(request: NextRequest, username: string, password: string) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    return separator >= 0 && same(decoded.slice(0, separator), username) && same(decoded.slice(separator + 1), password);
  } catch {
    return false;
  }
}

async function hasValidAdminSession(request: NextRequest) {
  const expected = await sessionToken();
  if (!expected) return false;
  const actual = [
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    request.cookies.get(LEGACY_ADMIN_SESSION_COOKIE)?.value,
  ].find((value) => Boolean(value));
  return Boolean(actual && same(actual, expected));
}

export async function isAdminRequest(request: NextRequest) {
  if (isLocalDevelopmentRequest(request)) return true;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return false;
  if (hasValidBasicAuthorization(request, username, password)) return true;
  return hasValidAdminSession(request);
}
