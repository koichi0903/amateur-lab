import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/admin/myfans/quote-refresh/route.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260924143000_formalize_myfans_quote_refresh_atomic_create.sql", "utf8");

assert.match(route, /await assertDatabaseReady\(\)/);
assert.match(route, /create_myfans_quote_refresh_job/);
assert.match(route, /compensateCreateFailure/);
assert.match(route, /CREATE_COMPENSATED/);
assert.match(route, /IDEMPOTENT_ACTIVE_SESSION/);
assert.match(route, /PGRST202|does not exist/);
assert.match(migration, /myfans_audit_logs_entity_type_check/);
for (const entityType of ["creator", "product", "x_post", "conversion", "click", "media", "import", "evidence", "quote_refresh_job", "quote_refresh_job_item"]) {
  assert.match(migration, new RegExp(`'${entityType}'`));
}
assert.match(migration, /myfans_quote_refresh_jobs_active_session_uidx/);
assert.match(migration, /create_myfans_quote_refresh_job/);
assert.match(migration, /jsonb_to_recordset/);
assert.match(migration, /exception when unique_violation/);
assert.match(migration, /revoke all on function/);
assert.doesNotMatch(migration, /\b(drop|truncate|delete)\s+(table|from|schema)/i);

console.log("Myfans transaction/idempotency contract fixtures passed (RPC, compensation, preflight, audit compatibility)");
