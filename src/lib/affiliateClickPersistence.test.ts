import assert from "node:assert/strict";
import test from "node:test";
import {
  insertAffiliateClickWithSchemaFallback,
  type AffiliateClickInsertRecord,
} from "./affiliateClickPersistence";

const fullRecord: AffiliateClickInsertRecord = {
  work_id: 42,
  placement: "listing-card",
  source_page: "x",
  cta_variant: "price-focus",
  x_post_key: "bluesky-20261031-1",
  external_channel: "social",
  external_source: "bluesky",
  landing_path: "/works/42?from=x",
};

test("insertAffiliateClickWithSchemaFallback returns after a successful first insert", async () => {
  const records: AffiliateClickInsertRecord[] = [];
  const error = await insertAffiliateClickWithSchemaFallback(fullRecord, async (record) => {
    records.push(record);
    return { error: null };
  });

  assert.equal(error, null);
  assert.deepEqual(records, [fullRecord]);
});

test("insertAffiliateClickWithSchemaFallback progressively falls back for generic schema-cache errors", async () => {
  const records: AffiliateClickInsertRecord[] = [];
  const error = await insertAffiliateClickWithSchemaFallback(fullRecord, async (record) => {
    records.push(record);
    return { error: records.length < 4 ? { code: "PGRST204", message: "column not found" } : null };
  });

  assert.equal(error, null);
  assert.deepEqual(records, [
    fullRecord,
    {
      work_id: 42,
      placement: "listing-card",
      source_page: "x",
      cta_variant: "price-focus",
      external_channel: "social",
      external_source: "bluesky",
      landing_path: "/works/42?from=x",
    },
    {
      work_id: 42,
      placement: "listing-card",
      source_page: "x",
      cta_variant: "price-focus",
    },
    {
      work_id: 42,
      placement: "listing-card",
      source_page: "x",
    },
  ]);
});

test("insertAffiliateClickWithSchemaFallback skips unrelated fields for a targeted attribution error", async () => {
  const records: AffiliateClickInsertRecord[] = [];
  const error = await insertAffiliateClickWithSchemaFallback(fullRecord, async (record) => {
    records.push(record);
    return {
      error: records.length === 1 ? { message: "Could not find external_source" } : null,
    };
  });

  assert.equal(error, null);
  assert.deepEqual(records, [
    fullRecord,
    {
      work_id: 42,
      placement: "listing-card",
      source_page: "x",
      cta_variant: "price-focus",
    },
  ]);
});

test("insertAffiliateClickWithSchemaFallback retries a missing CTA column without tracking fields", async () => {
  const records: AffiliateClickInsertRecord[] = [];
  const error = await insertAffiliateClickWithSchemaFallback(fullRecord, async (record) => {
    records.push(record);
    return {
      error: records.length === 1 ? { message: "Could not find cta_variant" } : null,
    };
  });

  assert.equal(error, null);
  assert.deepEqual(records, [
    fullRecord,
    { work_id: 42, placement: "listing-card", source_page: "x" },
  ]);
});

test("insertAffiliateClickWithSchemaFallback preserves the final non-schema error", async () => {
  const failure = { code: "XX000", message: "database unavailable" };
  const records: AffiliateClickInsertRecord[] = [];
  const error = await insertAffiliateClickWithSchemaFallback(fullRecord, async (record) => {
    records.push(record);
    return { error: failure };
  });

  assert.equal(error, failure);
  assert.deepEqual(records, [fullRecord]);
});
