import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceInfo } from "./parser";
import { syncWorkPrices } from "./syncWorkPrices";

type CurrentPrice = {
  id: number;
  display_name: string;
  period: string | null;
  price_kind: string;
  normal_price: number;
  sale_price: number | null;
};

function makeClient(currentPrices: CurrentPrice[] = []) {
  const calls: string[] = [];

  const client = {
    from(table: string) {
      let action = "select";
      const query = {
        select() {
          if (action !== "update" && action !== "delete") action = "select";
          return query;
        },
        eq() {
          return query;
        },
        insert() {
          action = "insert";
          return query;
        },
        update() {
          action = "update";
          return query;
        },
        delete() {
          action = "delete";
          return query;
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          calls.push(`${action}:${table}`);
          const data =
            action === "select"
              ? currentPrices
              : action === "update" || action === "delete"
                ? [{ id: 1 }]
                : null;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const samplePrice: PriceInfo = {
  name: "単品",
  period: "無期限",
  normalPrice: 1200,
  salePrice: 600,
  type: "購入",
};

test("inserts a new current price before recording its initial history", async () => {
  const { client, calls } = makeClient();

  const changed = await syncWorkPrices("ABC-123", [samplePrice], client);

  assert.equal(changed, true);
  assert.deepEqual(calls, [
    "select:work_prices",
    "insert:work_prices",
    "insert:price_history",
  ]);
});

test("records history before updating a changed current price", async () => {
  const { client, calls } = makeClient([
    {
      id: 7,
      display_name: "単品",
      period: "無期限",
      price_kind: "sale",
      normal_price: 1000,
      sale_price: 600,
    },
  ]);

  const changed = await syncWorkPrices("ABC-123", [samplePrice], client);

  assert.equal(changed, true);
  assert.deepEqual(calls, [
    "select:work_prices",
    "insert:price_history",
    "update:work_prices",
  ]);
});

test("leaves unchanged rows untouched", async () => {
  const { client, calls } = makeClient([
    {
      id: 7,
      display_name: "単品",
      period: "無期限",
      price_kind: "sale",
      normal_price: 1200,
      sale_price: 600,
    },
  ]);

  const changed = await syncWorkPrices("ABC-123", [samplePrice], client);

  assert.equal(changed, false);
  assert.deepEqual(calls, ["select:work_prices"]);
});

test("deletes previously stored prices missing from the refreshed catalog", async () => {
  const { client, calls } = makeClient([
    {
      id: 7,
      display_name: "古いプラン",
      period: "無期限",
      price_kind: "regular",
      normal_price: 1000,
      sale_price: null,
    },
  ]);

  const changed = await syncWorkPrices("ABC-123", [], client);

  assert.equal(changed, true);
  assert.deepEqual(calls, ["select:work_prices", "delete:work_prices"]);
});
