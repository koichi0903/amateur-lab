import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { handleCandidatePost, type CandidatePostDependencies, type PersistedSelection, type SelectionSnapshot } from "./candidatePostHandler";
import { rankXGrowthVideoCandidates, type VideoCandidateSignals } from "@/lib/xGrowthVideoSelection";

function restoreEnvironment(original: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test("candidate GET rejects requests without admin authentication", async (t) => {
  const original = Object.fromEntries(["ADMIN_USERNAME", "ADMIN_PASSWORD", "CRON_SECRET"].map((name) => [name, process.env[name]]));
  t.after(() => restoreEnvironment(original));
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.CRON_SECRET;

  const response = await GET(new NextRequest("http://example.test/api/admin/x-growth/video-candidates"));
  assert.equal(response.status, 401);
});

test("candidate POST validates revision before reading or writing the database", async (t) => {
  const original = Object.fromEntries(["ADMIN_USERNAME", "ADMIN_PASSWORD", "CRON_SECRET"].map((name) => [name, process.env[name]]));
  t.after(() => restoreEnvironment(original));
  process.env.ADMIN_USERNAME = "test-admin";
  process.env.ADMIN_PASSWORD = "test-password";
  process.env.CRON_SECRET = "test-cron-secret";
  const authorization = `Basic ${Buffer.from("test-admin:test-password").toString("base64")}`;

  const response = await POST(new NextRequest("http://example.test/api/admin/x-growth/video-candidates", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", expectedRevision: -1 }),
  }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /更新情報/);
});

test("candidate POST rejects unauthenticated writes before database access", async (t) => {
  const original = Object.fromEntries(["ADMIN_USERNAME", "ADMIN_PASSWORD", "CRON_SECRET"].map((name) => [name, process.env[name]]));
  t.after(() => restoreEnvironment(original));
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.CRON_SECRET;

  const response = await POST(new NextRequest("http://example.test/api/admin/x-growth/video-candidates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", expectedRevision: 0 }),
  }));
  assert.equal(response.status, 401);
});

test("candidate POST manual replacement and reset pass the intended state to the dedicated save boundary", async () => {
  const signals: VideoCandidateSignals[] = Array.from({ length: 8 }, (_, index) => ({
    workId: index + 1,
    title: `作品 ${index + 1}`,
    sampleUrlOfficial: true,
    hardGatePassed: true,
    firstDropReason: null,
    rankingScore: 80 - index,
    freshnessScore: 70,
    discountRate: 20,
    saleEndAt: null,
    creativeQualityScore: 75,
  }));
  const ranked = rankXGrowthVideoCandidates(signals, new Map(), new Date("2026-10-10T00:00:00Z"));
  const snapshot: SelectionSnapshot = {
    computedAt: "2026-10-10T00:00:00.000Z",
    evaluatedWorks: 8,
    hardGatePassedWorks: 8,
    candidates: ranked,
    shortageReason: null,
    failureCounts: {},
    pipeline: { candidateWorks: 8, qualityEvaluatedWorks: 8 },
  };
  const current: PersistedSelection = {
    account_handle: "hakkutsu_lab",
    selected_work_ids: [1, 2, 3, 4, 5],
    manual_override_work_ids: [],
    excluded_work_ids: [],
    candidate_snapshot: snapshot,
    revision: 2,
    updated_at: "2026-10-10T00:00:00.000Z",
  };
  const saveCalls: Array<Parameters<CandidatePostDependencies["saveSelection"]>> = [];
  let readState = current;
  const dependencies: CandidatePostDependencies = {
    isAdminRequest: async () => true,
    readSelection: async () => readState,
    evaluateVideoPool: async () => snapshot,
    saveSelection: async (...args) => {
      saveCalls.push(args);
      const [expectedRevision, selectedWorkIds, manualOverrideWorkIds, excludedWorkIds, candidateSnapshot] = args;
      const saved: PersistedSelection = {
        ...current,
        selected_work_ids: selectedWorkIds,
        manual_override_work_ids: manualOverrideWorkIds,
        excluded_work_ids: excludedWorkIds,
        candidate_snapshot: candidateSnapshot,
        revision: expectedRevision + 1,
      };
      readState = saved;
      return { conflict: false, selection: saved };
    },
  };

  const overrideResponse = await handleCandidatePost(new NextRequest("http://example.test/api/admin/x-growth/video-candidates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "override", expectedRevision: 2, selectedWorkIds: [2, 3, 4, 5, 6] }),
  }), dependencies);
  assert.equal(overrideResponse.status, 200);
  assert.deepEqual(saveCalls[0].slice(0, 4), [2, [6, 2, 3, 4, 5], [6], [1]]);

  const resetResponse = await handleCandidatePost(new NextRequest("http://example.test/api/admin/x-growth/video-candidates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "reset", expectedRevision: 3 }),
  }), dependencies);
  assert.equal(resetResponse.status, 200);
  assert.deepEqual(saveCalls[1].slice(0, 4), [3, [1, 2, 3, 4, 5], [], []]);

  const invalidOverrideResponse = await handleCandidatePost(new NextRequest("http://example.test/api/admin/x-growth/video-candidates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "override", expectedRevision: 4, selectedWorkIds: ["6"] }),
  }), dependencies);
  assert.equal(invalidOverrideResponse.status, 400);

  const ineligibleOverrideResponse = await handleCandidatePost(new NextRequest("http://example.test/api/admin/x-growth/video-candidates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "override", expectedRevision: 4, selectedWorkIds: [99] }),
  }), dependencies);
  assert.equal(ineligibleOverrideResponse.status, 409);
  assert.equal(saveCalls.length, 2);
});

test("candidate migration restricts table and RPC access to service_role", () => {
  const migration = readFileSync("supabase/migrations/20261010105757_add_x_growth_video_candidate_selections.sql", "utf8");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table[\s\S]*from anon, authenticated/i);
  assert.match(migration, /grant select, insert, update on table[\s\S]*to service_role/i);
  assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/i);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
});
