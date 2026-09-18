import type { NextRequest } from "next/server";

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

export async function isAdminRequest(request: NextRequest) {
  if (["localhost", "127.0.0.1"].includes(request.nextUrl.hostname)) return true;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return false;
  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const separator = decoded.indexOf(":");
      if (separator >= 0 && same(decoded.slice(0, separator), username) && same(decoded.slice(separator + 1), password)) return true;
    } catch { /* invalid header */ }
  }
  const expected = await sessionToken();
  const cookieName = request.nextUrl.protocol === "https:" ? "__Host-hakkutsu_admin" : "hakkutsu_admin";
  const actual = request.cookies.get(cookieName)?.value;
  return Boolean(expected && actual && same(actual, expected));
}
