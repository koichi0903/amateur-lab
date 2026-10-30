import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20260926062349_add_myfans_multi_account_scoping.sql", "utf8");
const analytics = fs.readFileSync("src/lib/myfansAnalytics.ts", "utf8");
const postActions = fs.readFileSync("src/lib/myfansAdminPostActions.ts", "utf8");
const page = fs.readFileSync("src/app/admin/myfans/page.tsx", "utf8");

assert.match(migration, /account_key text/);
assert.match(migration, /'@fansmy230'/);
assert.match(migration, /myfans_x_posts_account_idempotency_key_uidx/);
assert.match(migration, /myfans_permanent_candidate_exclusions_account_entity/);
assert.match(migration, /save_myfans_post/);
assert.match(analytics, /approved_media_id/);
assert.match(analytics, /fetchMyfansPermanentExclusions\(options\.approvedMediaId\)/);
assert.match(postActions, /nullableId\(formData, "approved_media_id"\)/);
assert.doesNotMatch(page, /permanentRedirect\("\/admin\/myfans\?media=1"\)/);
console.log("myfans multi-account contract: ok");
