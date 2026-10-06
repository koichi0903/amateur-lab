import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { isAdminRequest } from "./requestAuth.ts";

const username = "test-admin";
const password = "test-password";
const cronSecret = "test-cron-secret";

function sessionToken() {
  return createHash("sha256")
    .update(`hakkutsu-admin-session\0${username}\0${password}\0${cronSecret}`)
    .digest("hex");
}

function request(url: string, cookie?: string, authorization?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (authorization) headers.set("authorization", authorization);
  return new NextRequest(url, { headers });
}

test("admin session cookie is accepted across route/proxy protocol views", async () => {
  process.env.ADMIN_USERNAME = username;
  process.env.ADMIN_PASSWORD = password;
  process.env.CRON_SECRET = cronSecret;
  const token = sessionToken();

  assert.equal(await isAdminRequest(request("https://example.com/api/admin/bijyo-reserved", `hakkutsu_admin=${token}`)), true);
  assert.equal(await isAdminRequest(request("http://example.com/api/admin/bijyo-reserved", `__Host-hakkutsu_admin=${token}`)), true);
});

test("basic auth remains accepted and unauthenticated requests remain rejected", async () => {
  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  assert.equal(await isAdminRequest(request("https://example.com/api/admin/bijyo-reserved", undefined, `Basic ${basic}`)), true);
  assert.equal(await isAdminRequest(request("https://example.com/api/admin/bijyo-reserved")), false);
});
