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
