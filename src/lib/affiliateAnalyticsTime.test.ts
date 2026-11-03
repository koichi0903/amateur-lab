import assert from "node:assert/strict";
import test from "node:test";
import {
  affiliateAnalyticsJstDayKey,
  buildAffiliateClickTimeMetrics,
  buildAffiliateDailyClickCounts,
} from "./affiliateAnalyticsTime.ts";

const now = new Date("2026-11-01T03:00:00.000Z");

test("uses Japan calendar days for today's click count", () => {
  assert.equal(affiliateAnalyticsJstDayKey(now), "2026-11-01");
  assert.equal(buildAffiliateClickTimeMetrics([
    { clicked_at: "2026-10-31T14:59:59.999Z" },
    { clicked_at: "2026-10-31T15:00:00.000Z" },
  ], now).today, 1);
});

test("keeps exact seven-day and fourteen-day window boundaries", () => {
  const sevenDayCutoff = now.getTime() - 7 * 86_400_000;
  const previousSevenDayCutoff = now.getTime() - 14 * 86_400_000;
  const metrics = buildAffiliateClickTimeMetrics([
    { clicked_at: new Date(sevenDayCutoff).toISOString() },
    { clicked_at: new Date(sevenDayCutoff - 1).toISOString() },
    { clicked_at: new Date(previousSevenDayCutoff).toISOString() },
    { clicked_at: new Date(previousSevenDayCutoff - 1).toISOString() },
  ], now);

  assert.equal(metrics.lastSevenDays, 1);
  assert.equal(metrics.previousSevenDays, 2);
  assert.equal(metrics.growthRate, -50);
});

test("builds the same fourteen JST daily buckets and leaves missing days at zero", () => {
  const daily = buildAffiliateDailyClickCounts([
    { clicked_at: "2026-10-31T15:00:00.000Z" },
    { clicked_at: "2026-10-31T16:00:00.000Z" },
    { clicked_at: "2026-10-17T15:00:00.000Z" },
  ], now);

  assert.equal(daily.length, 14);
  assert.equal(daily[0].key, "2026-10-19");
  assert.deepEqual(daily.at(-1), { key: "2026-11-01", count: 2 });
  assert.equal(daily[0].count, 0);
});

test("returns a null growth rate when the previous week has no clicks", () => {
  assert.equal(buildAffiliateClickTimeMetrics([
    { clicked_at: "2026-11-01T03:00:00.000Z" },
  ], now).growthRate, null);
});
