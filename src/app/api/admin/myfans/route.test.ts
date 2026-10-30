import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

type CapturedRequest = {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
};

function skipRequest() {
  const formData = new FormData();
  formData.set("action", "permanent_candidate_skip");
  formData.set("quote_x_url", "https://x.com/creator/status/123?ref=plan");
  formData.set("quote_candidate_id", "42");
  formData.set("approved_media_id", "7");
  formData.set("plan_date", "2026-10-10");
  formData.set("candidate_id", "candidate-1");
  return new Request("http://localhost/api/admin/myfans", { method: "POST", body: formData });
}

async function captureFetches(responses: Response[]) {
  const requests: CapturedRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input.clone() : undefined;
    const url = new URL(request?.url ?? String(input));
    const headers = new Headers(init?.headers ?? request?.headers);
    const method = init?.method ?? request?.method ?? "GET";
    const bodyText = init?.body
      ? String(init.body)
      : request && method !== "GET" && method !== "HEAD"
        ? await request.text()
        : "";
    let body: unknown = bodyText;
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        // Keep non-JSON request bodies as text for useful assertions.
      }
    }
    requests.push({ url, method, headers, body });
    const response = responses.shift();
    assert.ok(response, `Unexpected request to ${url.pathname}`);
    return response;
  };

  return {
    requests,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

test("permanent_candidate_skip sends the validated idempotent upsert through Supabase", async () => {
  const fetchMock = await captureFetches([
    new Response("[]", { status: 201, headers: { "content-type": "application/json" } }),
    new Response("", { status: 201 }),
  ]);

  try {
    const response = await POST(skipRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      entityKey: "source:https://x.com/creator/status/123",
    });
    assert.equal(fetchMock.requests.length, 2);

    const [upsert, audit] = fetchMock.requests;
    assert.equal(upsert.method, "POST");
    assert.equal(upsert.url.pathname, "/rest/v1/myfans_permanent_candidate_exclusions");
    assert.equal(upsert.url.searchParams.get("on_conflict"), "approved_media_id,entity_type,entity_key");
    assert.match(upsert.headers.get("prefer") ?? "", /resolution=ignore-duplicates/);
    assert.deepEqual(upsert.body, {
      entity_type: "source",
      entity_key: "source:https://x.com/creator/status/123",
      product_id: null,
      source_status_url: "https://x.com/creator/status/123",
      quote_candidate_id: 42,
      approved_media_id: 7,
      reason: "user_skipped",
      context: {
        recorded_from: "myfans_3x4_skip",
        plan_date: "2026-10-10",
        candidate_id: "candidate-1",
      },
    });
    assert.equal(audit.url.pathname, "/rest/v1/myfans_audit_logs");
  } finally {
    fetchMock.restore();
  }
});

test("permanent_candidate_skip maps a PostgREST 42P10 response to the safe API error", async () => {
  const fetchMock = await captureFetches([
    new Response(JSON.stringify({
      code: "42P10",
      details: null,
      hint: null,
      message: "no unique or exclusion constraint matching the ON CONFLICT specification",
    }), { status: 400, headers: { "content-type": "application/json" } }),
  ]);
  const originalConsoleError = console.error;
  const errors: unknown[] = [];
  console.error = (...args: unknown[]) => errors.push(args);

  try {
    const response = await POST(skipRequest());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。",
    });
    assert.equal(fetchMock.requests.length, 1);
    assert.match(String((errors[0] as unknown[])[0]), /myfans admin action failed/);
    assert.deepEqual((errors[0] as unknown[])[1], {
      action: "permanent_candidate_skip",
      errorCode: "42P10",
      errorType: "UnknownError",
    });
  } finally {
    fetchMock.restore();
    console.error = originalConsoleError;
  }
});
