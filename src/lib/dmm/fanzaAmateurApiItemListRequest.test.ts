import assert from "node:assert/strict";
import test from "node:test";
import { fetchFanzaAmateurApiItemListPage, safeFanzaAmateurApiError } from "./fanzaAmateurApiItemListRequest.ts";

test("date catalog requests share the expected FANZA parameters and range", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const result = await fetchFanzaAmateurApiItemListPage(
    { offset: 101, hits: 100, sort: "date", range: { fromDate: "2026-10-01", toDate: "2026-10-31" } },
    {
      apiId: "test-api-id",
      affiliateId: "test-affiliate-991",
      fetcher: async (input, init) => {
        requestUrl = input;
        requestInit = init;
        return new Response(JSON.stringify({ result: { status: "200", total_count: "102", items: [{ content_id: "abc" }] } }));
      },
    },
  );

  const url = new URL(requestUrl);
  assert.equal(url.origin, "https://api.dmm.com");
  assert.equal(url.pathname, "/affiliate/v3/ItemList");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    api_id: "test-api-id",
    affiliate_id: "test-affiliate-991",
    site: "FANZA",
    service: "digital",
    floor: "videoc",
    hits: "100",
    offset: "101",
    sort: "date",
    output: "json",
    gte_date: "2026-10-01T00:00:00",
    lte_date: "2026-10-31T23:59:59",
  });
  assert.equal(requestInit?.cache, "no-store");
  assert.deepEqual(result.rawItems, [{ content_id: "abc" }]);
});

test("popularity requests omit date filters and preserve the API error label inputs", async () => {
  let requestUrl = "";
  const result = await fetchFanzaAmateurApiItemListPage(
    { offset: 4901, hits: 100, sort: "rank" },
    {
      apiId: "test-api-id",
      affiliateId: "test-affiliate-991",
      fetcher: async (input) => {
        requestUrl = input;
        return new Response(JSON.stringify({ result: { status: 403, items: null } }), { status: 403 });
      },
    },
  );

  const url = new URL(requestUrl);
  assert.equal(url.searchParams.get("sort"), "rank");
  assert.equal(url.searchParams.get("offset"), "4901");
  assert.equal(url.searchParams.has("gte_date"), false);
  assert.equal(result.response.ok, false);
  assert.equal(safeFanzaAmateurApiError(result.response.status, result.payload), "DMM APIの取得に失敗しました（HTTP 403 / API 403）。");
});

test("missing API credentials fail before making a request", async () => {
  let called = false;
  await assert.rejects(
    fetchFanzaAmateurApiItemListPage(
      { offset: 1, hits: 100, sort: "rank" },
      { apiId: "", fetcher: async () => { called = true; return new Response("{}"); } },
    ),
    /DMM API IDが設定されていません/,
  );
  assert.equal(called, false);
});
