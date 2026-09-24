import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/admin/myfans/page.tsx", "utf8");
const forms = fs.readFileSync("src/app/admin/myfans/MyfansAdminForms.tsx", "utf8");
const route = fs.readFileSync("src/app/api/admin/myfans/daily-plan/reevaluate/route.ts", "utf8");
const view = fs.readFileSync("src/lib/myfansDailySnapshotView.ts", "utf8");

assert.match(page, /restorePersistedDailySnapshot/);
assert.match(page, /currentPlan.*board\.planDate/);
assert.match(page, /persistedSnapshot && <PersistedDailyPlanBoard/);
assert.match(page, /<XExecutionBoard candidates=\{board\.candidates\}/);
assert.match(page, /4 Slot × 最大3/);
assert.match(page, /displaySelectedCount/);
assert.doesNotMatch(page, /snapshot\?\.selectedOptions/);
assert.match(forms, /router\.refresh\(\)/);
assert.match(forms, /保存状態は変更されていません/);
assert.match(forms, /candidate\.mediaPermalink/);
assert.match(forms, /引用画像\/動画/);
assert.match(route, /ensureMyfansDailySnapshot/);
assert.match(route, /保存状態は変更されていません/);
assert.match(view, /const slots = rawSlots\.map/);
assert.match(view, /selectedCount/);

console.log("Myfans persisted snapshot priority contract passed");
