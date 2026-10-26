import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { NextRequest } from "next/server";

import { POST } from "./route.ts";

const username = "url-inspection-admin";
const password = "unit-test-password";

function request(body: unknown, authorization?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) headers.set("authorization", authorization);
  return new NextRequest("http://localhost:3000/api/admin/google-url-inspection", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function adminAuthorization() {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

test("URL Inspection API rejects unauthenticated calls", async () => {
  process.env.ADMIN_USERNAME = username;
  process.env.ADMIN_PASSWORD = password;

  const response = await POST(request({ urls: ["https://hakkutsu-lab.com/actress/AIKA"] }));
  assert.equal(response.status, 401);
});

test("URL Inspection API only accepts unique actress URLs and caps each request", async () => {
  const auth = adminAuthorization();
  const invalid = await POST(request({ urls: ["https://example.com/actress/AIKA"] }, auth));
  assert.equal(invalid.status, 400);

  const duplicate = await POST(request({
    urls: [
      "https://hakkutsu-lab.com/actress/AIKA",
      "https://hakkutsu-lab.com/actress/AIKA",
    ],
  }, auth));
  assert.equal(duplicate.status, 400);

  const tooMany = await POST(request({
    urls: Array.from({ length: 636 }, (_, index) => `https://hakkutsu-lab.com/actress/test-${index}`),
  }, auth));
  assert.equal(tooMany.status, 400);
});

test("URL Inspection API uses read-only Google scope and returns saved index status", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "url-inspection-test@example.iam.gserviceaccount.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), { status: 200 });
    }
    const submitted = JSON.parse(String(init?.body)) as { inspectionUrl: string; siteUrl: string };
    return new Response(JSON.stringify({ inspectionResult: {
      inspectionResultLink: "https://search.google.com/search-console/inspect",
      indexStatusResult: {
        verdict: "PASS",
        coverageState: "送信して登録されました",
        indexingState: "INDEXING_ALLOWED",
        robotsTxtState: "ALLOWED",
        lastCrawlTime: "2026-10-26T01:00:00Z",
        userCanonical: submitted.inspectionUrl,
        googleCanonical: submitted.inspectionUrl,
        sitemap: ["https://hakkutsu-lab.com/sitemap.xml"],
      },
    } }), { status: 200 });
  };

  try {
    const urls = [
      "https://hakkutsu-lab.com/actress/AIKA",
      "https://hakkutsu-lab.com/actress/Himari",
    ];
    const response = await POST(request({ urls }, adminAuthorization()));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.requested, 2);
    assert.equal(body.succeeded, 2);
    assert.equal(body.failed, 0);
    assert.equal(body.source, "google-index-snapshot");
    assert.equal(body.results[0].inspection.indexStatusResult.lastCrawlTime, "2026-10-26T01:00:00Z");
    assert.equal(calls.filter((call) => call.url === "https://oauth2.googleapis.com/token").length, 1);
    const inspectionCalls = calls.filter((call) => call.url === "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
    assert.equal(inspectionCalls.length, 2);
    assert.equal(inspectionCalls[0].init?.method, "POST");
    assert.equal(inspectionCalls[0].init?.cache, "no-store");
    assert.match(String(inspectionCalls[0].init?.headers && new Headers(inspectionCalls[0].init.headers).get("authorization")), /^Bearer test-access-token$/);
    const oauthBody = new URLSearchParams(String(calls[0].init?.body));
    const assertion = oauthBody.get("assertion")?.split(".")[1];
    assert.ok(assertion);
    assert.equal(JSON.parse(Buffer.from(assertion, "base64url").toString()).scope, "https://www.googleapis.com/auth/webmasters.readonly");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  }
});
