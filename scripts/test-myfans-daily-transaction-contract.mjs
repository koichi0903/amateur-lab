import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260924200000_harden_myfans_daily_snapshot_and_post_idempotency.sql", "utf8");
const snapshot = fs.readFileSync("src/lib/myfansDailySnapshot.ts", "utf8");
const postRoute = fs.readFileSync("src/app/api/admin/myfans/route.ts", "utf8");
const reevaluateRoute = fs.readFileSync("src/app/api/admin/myfans/daily-plan/reevaluate/route.ts", "utf8");
const forms = fs.readFileSync("src/app/admin/myfans/MyfansAdminForms.tsx", "utf8");

assert.match(migration, /MYFANS_DAILY_PLAN_DUPLICATES_PRESENT/);
assert.match(migration, /myfans_daily_plans_media_date_coalesce_uidx/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /save_myfans_daily_snapshot/);
assert.match(migration, /delete from public\.myfans_daily_plan_posts/);
assert.match(migration, /delete from public\.myfans_attention_candidates/);
assert.match(migration, /myfans_daily_plan_funnel_audit/);
assert.match(migration, /save_myfans_post/);
assert.match(migration, /use_count = use_count \+ 1/);
assert.match(migration, /myfans_x_posts_idempotency_key_uidx/);
assert.match(migration, /revoke all on function public\.save_myfans_daily_snapshot/);
assert.match(migration, /grant execute on function public\.save_myfans_daily_snapshot[^;]*service_role/);
assert.match(migration, /revoke all on function public\.save_myfans_post/);
assert.match(migration, /grant execute on function public\.save_myfans_post[^;]*service_role/);

assert.match(snapshot, /rpc\("save_myfans_daily_snapshot"/);
assert.match(snapshot, /media_permalink: candidate\.mediaPermalink/);
assert.doesNotMatch(snapshot, /\.from\("myfans_daily_plans"\)\s*\.insert/);
assert.doesNotMatch(snapshot, /\.from\("myfans_daily_plan_posts"\)\s*\.insert/);
assert.match(postRoute, /rpc\("save_myfans_post"/);
assert.doesNotMatch(postRoute, /use_count:\s*1/);
assert.match(reevaluateRoute, /保存状態は変更されていません/);
assert.match(forms, /payload\.error/);
assert.match(forms, /再評価中/);

console.log("Myfans daily/post transaction contract passed");
