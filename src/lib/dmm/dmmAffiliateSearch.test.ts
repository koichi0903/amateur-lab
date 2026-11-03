import assert from "node:assert/strict";
import test from "node:test";
import { searchDmmAffiliate } from "./dmmAffiliateSearch.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const logger = { info() {}, error() {} };

test("empty keyword results fall back only to one normalized exact actress match", async () => {
  const calls: URL[] = [];
  const responses = [
    jsonResponse({ result: { status: 200, code: 0, total_count: 0, items: [] } }),
    jsonResponse({ result: { status: 200, code: 0, actress: [{ actress_id: "123", name: " ふわふわ　なお " }] } }),
    jsonResponse({ result: { status: 200, code: 0, total_count: 2, items: [{ content_id: "work-1" }] } }),
  ];

  const outcome = await searchDmmAffiliate({
    apiId: "api",
    affiliateId: "affiliate",
    requestUrl: "https://local.test/api/dmm?keyword=%E3%81%B5%E3%82%8F%E3%81%B5%E3%82%8F%20%E3%81%AA%E3%81%8A",
    fetcher: async (input) => {
      calls.push(new URL(String(input)));
      return responses.shift()!;
    },
    logger,
  });

  assert.equal(outcome.success, true);
  if (!outcome.success) return;
  assert.deepEqual(outcome.items, [{ content_id: "work-1" }]);
  assert.deepEqual(outcome.meta, { searchMode: "actress", totalCount: 2 });
  assert.equal(outcome.diagnostics.actressSearch.exactMatchCount, 1);
  assert.equal(outcome.diagnostics.actressFallback.selectedActressId, "123");
  assert.equal(calls.length, 3);
  assert.equal(calls[2].searchParams.get("article_id"), "123");
});

test("ambiguous exact actress matches do not choose a candidate or issue a fallback request", async () => {
  const calls: URL[] = [];
  const responses = [
    jsonResponse({ result: { status: 200, code: 0, total_count: 0, items: [] } }),
    jsonResponse({ result: { status: 200, code: 0, actress: [
      { id: 12, name: "同じ名前" },
      { id: 13, name: " 同じ名前 " },
    ] } }),
  ];

  const outcome = await searchDmmAffiliate({
    apiId: "api",
    affiliateId: "affiliate",
    requestUrl: "https://local.test/api/dmm?keyword=%E5%90%8C%E3%81%98%E5%90%8D%E5%89%8D",
    fetcher: async (input) => {
      calls.push(new URL(String(input)));
      return responses.shift()!;
    },
    logger,
  });

  assert.equal(outcome.success, true);
  if (!outcome.success) return;
  assert.equal(outcome.meta.searchMode, "keyword");
  assert.equal(outcome.diagnostics.actressSearch.exactMatchCount, 2);
  assert.equal(outcome.diagnostics.actressFallback.attempted, false);
  assert.equal(calls.length, 2);
});

test("invalid primary item shape returns the existing API error without actress fallback", async () => {
  let callCount = 0;
  const outcome = await searchDmmAffiliate({
    apiId: "api",
    affiliateId: "affiliate",
    requestUrl: "https://local.test/api/dmm",
    fetcher: async () => {
      callCount += 1;
      return jsonResponse({ result: { status: 200, code: 0, items: null } });
    },
    logger,
  });

  assert.equal(outcome.success, false);
  if (outcome.success) return;
  assert.equal(outcome.error.code, "DMM_API_INVALID_ITEMS");
  assert.equal(outcome.status, 502);
  assert.equal(callCount, 1);
});

test("CID search keeps CID mode and does not request keyword or actress fallback", async () => {
  const calls: URL[] = [];
  const outcome = await searchDmmAffiliate({
    apiId: "api",
    affiliateId: "affiliate",
    requestUrl: "https://local.test/api/dmm?cid=sample-001",
    fetcher: async (input) => {
      calls.push(new URL(String(input)));
      return jsonResponse({ result: { status: 200, code: 0, total_count: 1, items: [{ content_id: "work-1" }] } });
    },
    logger,
  });

  assert.equal(outcome.success, true);
  if (!outcome.success) return;
  assert.deepEqual(outcome.meta, { searchMode: "cid", totalCount: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("cid"), "sample-001");
  assert.equal(calls[0].searchParams.has("keyword"), false);
});
