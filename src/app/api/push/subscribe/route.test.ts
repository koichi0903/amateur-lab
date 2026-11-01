import assert from "node:assert/strict";
import test from "node:test";
import { saveAmateurSubscription, saveWorkSubscription } from "./persist";
import { validatePushSubscriptionPayload, type ValidatedPushSubscriptionPayload } from "@/lib/pushSubscriptionPayload";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const sharedBody = {
  subscription: {
    endpoint: "https://push.example.test/subscription/1",
    keys: { p256dh: "test-public-key", auth: "test-auth-key" },
  },
};

function amateurPayload(): Extract<ValidatedPushSubscriptionPayload, { kind: "amateur" }> {
  const result = validatePushSubscriptionPayload({
    ...sharedBody,
    mediaType: "amateur",
    contentId: "test-content-id",
  });
  if (!result.ok) throw new Error(result.message);
  if (result.value.kind !== "amateur") throw new Error("Expected an amateur subscription payload");
  return result.value;
}

function workPayload(): Extract<ValidatedPushSubscriptionPayload, { kind: "work" }> {
  const result = validatePushSubscriptionPayload({ ...sharedBody, workId: 123 });
  if (!result.ok) throw new Error(result.message);
  if (result.value.kind !== "work") throw new Error("Expected a work subscription payload");
  return result.value;
}

async function withLookupResponse(response: Response, callback: () => Promise<Response>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.match(url.pathname, /^\/rest\/v1\/(fanza_amateur_works|works)$/);
    return response;
  };
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withCapturedResponses(responses: Response[], callback: (requests: Array<{ url: URL; method: string; body: unknown }>) => Promise<Response>) {
  const requests: Array<{ url: URL; method: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const requestUrl = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const rawBody = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
    requests.push({
      url: requestUrl,
      method,
      body: typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody,
    });
    const response = responses.shift();
    assert.ok(response, `Unexpected request to ${requestUrl.pathname}`);
    return response;
  };
  try {
    return await callback(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function databaseError() {
  return new Response(JSON.stringify({ code: "XX000", message: "database lookup failed" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}

function missingRow() {
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
}

test("amateur subscription lookup errors remain server errors", async () => {
  const response = await withLookupResponse(databaseError(), () =>
    saveAmateurSubscription(amateurPayload(), new Request("http://localhost", { headers: { "user-agent": "test" } })),
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "素人作品の通知設定を確認できませんでした" });
});

test("regular subscription lookup errors remain server errors", async () => {
  const response = await withLookupResponse(databaseError(), () =>
    saveWorkSubscription(workPayload(), new Request("http://localhost", { headers: { "user-agent": "test" } })),
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "作品の通知設定を確認できませんでした" });
});

test("missing amateur works remain not found", async () => {
  const response = await withLookupResponse(missingRow(), () =>
    saveAmateurSubscription(amateurPayload(), new Request("http://localhost")),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "対象の素人作品が見つかりません" });
});

test("missing regular works remain not found", async () => {
  const response = await withLookupResponse(missingRow(), () =>
    saveWorkSubscription(workPayload(), new Request("http://localhost")),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "対象作品が見つかりません" });
});

test("amateur notifications read the legacy price and maker columns", async () => {
  const responses = [
    new Response(JSON.stringify([{
      content_id: "test-content-id",
      prices: { price: "1,200円", list_price: "2,000円" },
      iteminfo: { maker: [{ name: "Maker One" }] },
    }]), { status: 200, headers: { "content-type": "application/json" } }),
    new Response(null, { status: 201 }),
    new Response(null, { status: 201 }),
    new Response(null, { status: 204 }),
    new Response(null, { status: 201 }),
  ];

  const response = await withCapturedResponses(responses, async (requests) => {
    const payloadResult = validatePushSubscriptionPayload({
      ...sharedBody,
      mediaType: "amateur",
      contentId: "test-content-id",
      priceAlert: true,
      makerAlerts: ["Maker One"],
    });
    assert.ok(payloadResult.ok);
    if (!payloadResult.ok || payloadResult.value.kind !== "amateur") throw new Error("Expected validated amateur payload");
    const result = await saveAmateurSubscription(payloadResult.value, new Request("http://localhost"));

    assert.match(requests[0].url.searchParams.get("select") ?? "", /^content_id,prices,iteminfo$/);
    assert.deepEqual(requests[2].body, {
      endpoint: "https://push.example.test/subscription/1",
      content_id: "test-content-id",
      last_notified_price: 1200,
    });
    assert.deepEqual(requests[4].body, [{
      endpoint: "https://push.example.test/subscription/1",
      maker_name: "Maker One",
    }]);
    return result;
  });

  assert.equal(response.status, 200);
});
