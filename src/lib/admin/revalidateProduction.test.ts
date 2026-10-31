import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { revalidateProduction } from "./revalidateProduction.ts";

async function withEnvironment(values: Record<string, string | undefined>, action: () => Promise<void>) {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await action();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("posts tasks to the configured production URL with cron authentication", async () => {
  await withEnvironment({
    ENABLE_PRODUCTION_REVALIDATE: "true",
    NEXT_PUBLIC_SITE_URL: "https://example.com///",
    CRON_SECRET: "cron-secret",
    SUPABASE_SERVICE_ROLE_KEY: "signing-secret",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: 204 });
    };
    try {
      await revalidateProduction(["works"]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://example.com/api/admin/revalidate");
    assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer cron-secret");
    assert.equal(calls[0].init?.body, JSON.stringify({ tasks: ["works"] }));
  });
});

test("signs fallback requests and tries the next production URL after failure", async () => {
  await withEnvironment({
    ENABLE_PRODUCTION_REVALIDATE: "true",
    NEXT_PUBLIC_SITE_URL: undefined,
    CRON_SECRET: undefined,
    SUPABASE_SERVICE_ROLE_KEY: "signing-secret",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: calls.length === 1 ? 503 : 204 });
    };
    try {
      await revalidateProduction(["prices"]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.deepEqual(calls.map((call) => call.url), [
      "https://hakkutsu-lab.com/api/admin/revalidate",
      "https://amateur-lab.vercel.app/api/admin/revalidate",
    ]);
    const headers = new Headers(calls[0].init?.headers);
    const timestamp = headers.get("x-hakkutsu-timestamp");
    const body = JSON.stringify({ tasks: ["prices"] });
    assert.ok(timestamp);
    assert.equal(
      headers.get("x-hakkutsu-signature"),
      createHmac("sha256", "signing-secret").update(`${timestamp}.${body}`).digest("hex"),
    );
  });
});

test("requires an authentication secret before making a request", async () => {
  await withEnvironment({
    ENABLE_PRODUCTION_REVALIDATE: "true",
    NEXT_PUBLIC_SITE_URL: "https://example.com",
    CRON_SECRET: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  }, async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response(null, { status: 204 });
    };
    try {
      await assert.rejects(revalidateProduction(["works"]), /認証設定がありません/);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(called, false);
  });
});
