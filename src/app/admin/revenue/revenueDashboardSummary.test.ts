import assert from "node:assert/strict";
import test from "node:test";
import { buildRevenueDashboardSummary } from "./revenueDashboardSummary.ts";

test("summarizes official confirmed results separately from site CTA events", () => {
  const summary = buildRevenueDashboardSummary({
    daily: [{ count: 0 }, { count: 8 }, { count: 3 }],
    totals: { thirtyDays: 10, growthRate: 25 },
    placements: [
      { key: "desktop-sidebar", count: 8 },
      { key: "mobile-sticky", count: 4 },
    ],
  }, [
    { report_status: "confirmed", click_count: 7, direct_reward_yen: 100, category_reward_yen: 20, service_reward_yen: 30 },
    { report_status: "provisional", click_count: 50, direct_reward_yen: 900, category_reward_yen: 800, service_reward_yen: 700 },
    { report_status: "confirmed", click_count: 2, direct_reward_yen: 10, category_reward_yen: 0, service_reward_yen: 5 },
  ]);

  assert.deepEqual(summary, {
    id990Confirmed: { dayCount: 2, clickCount: 9, rewardYen: 165 },
    maxDaily: 8,
    thirtyDayTotal: 10,
    mobileClicks: 4,
    mobileShare: 40,
    growthNote: "前の7日間比 +25%",
  });
});

test("uses zero for an unavailable mobile share and explains a missing comparison period", () => {
  const summary = buildRevenueDashboardSummary({
    daily: [],
    totals: { thirtyDays: 0, growthRate: null },
    placements: [],
  }, []);

  assert.deepEqual(summary, {
    id990Confirmed: { dayCount: 0, clickCount: 0, rewardYen: 0 },
    maxDaily: 1,
    thirtyDayTotal: 0,
    mobileClicks: 0,
    mobileShare: 0,
    growthNote: "比較データがまだありません",
  });
});
