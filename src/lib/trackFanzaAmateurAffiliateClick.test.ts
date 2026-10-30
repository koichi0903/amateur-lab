import assert from "node:assert/strict";
import test from "node:test";
import { trackFanzaAmateurAffiliateClick } from "./trackFanzaAmateurAffiliateClick.ts";

test("affiliate click records GA4 and first-party attribution without delaying navigation", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  const events: unknown[][] = [];
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { gtag: (...args: unknown[]) => events.push(args) },
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    trackFanzaAmateurAffiliateClick({
      contentId: "sample-001",
      sourcePage: "amateur_detail",
      placement: "detail-sidebar",
    });

    assert.deepEqual(events, [[
      "event",
      "amateur_affiliate_click",
      {
        content_id: "sample-001",
        source_page: "amateur_detail",
        affiliate_id: "991",
        placement: "detail-sidebar",
      },
    ]]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].input, "/api/amateur-affiliate-click");
    assert.equal(requests[0].init?.method, "POST");
    assert.equal(requests[0].init?.keepalive, true);
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      contentId: "sample-001",
      sourcePage: "amateur_detail",
      placement: "detail-sidebar",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
