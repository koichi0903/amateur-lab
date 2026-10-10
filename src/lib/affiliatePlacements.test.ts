import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AFFILIATE_PLACEMENTS, isAffiliatePlacement } from "./affiliatePlacements";
import { AFFILIATE_SOURCES } from "./affiliateTracking";

const trackingMigration = readFileSync(
  new URL("../../supabase/migrations/20261010021516_sync_affiliate_tracking_constraints.sql", import.meta.url),
  "utf8",
);

function migrationValues(table: string, column: string) {
  const constraintName = `${table}_${column}_check`;
  const pattern = new RegExp(
    `alter table public\\.${table}[\\s\\S]*?add constraint ${constraintName}[\\s\\S]*?check \\(\\s*${column} in \\(([\\s\\S]*?)\\)\\s*\\);`,
    "i",
  );
  const match = trackingMigration.match(pattern);
  assert.ok(match, `Missing ${constraintName} from tracking migration`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]);
}

test("all declared affiliate CTA placements are accepted by click tracking", () => {
  assert.deepEqual(AFFILIATE_PLACEMENTS, [
    "listing-card",
    "detail-sidebar",
    "buy-timing-panel",
    "mobile-sticky",
    "compare-card",
    "sample-movie-fallback",
  ]);

  for (const placement of AFFILIATE_PLACEMENTS) {
    assert.equal(isAffiliatePlacement(placement), true);
  }
});

test("unknown CTA placements remain invalid", () => {
  assert.equal(isAffiliatePlacement("not-a-placement"), false);
  assert.equal(isAffiliatePlacement(null), false);
});

test("database click placement constraint matches the application values", () => {
  assert.deepEqual(migrationValues("affiliate_clicks", "placement"), AFFILIATE_PLACEMENTS);
});

test("database source constraints match every source accepted by the application", () => {
  for (const table of ["affiliate_clicks", "affiliate_cta_impressions", "work_page_views"]) {
    assert.deepEqual(migrationValues(table, "source_page"), AFFILIATE_SOURCES);
  }
});
