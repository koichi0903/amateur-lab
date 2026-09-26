import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const forms = fs.readFileSync(new URL("src/app/admin/myfans/MyfansAdminForms.tsx", root), "utf8");
const route = fs.readFileSync(new URL("src/app/api/admin/myfans/route.ts", root), "utf8");
const refresh = fs.readFileSync(new URL("src/app/api/admin/myfans/quote-refresh/route.ts", root), "utf8");

assert.match(forms, /formData\.set\("quote_x_url", candidate\.quoteXUrl \|\| candidate\.sourceXUrl\)/);
assert.match(forms, /disabled=\{!selected \|\| pendingId === candidate\.id/);
assert.doesNotMatch(forms, /disabled=\{!selected \|\| !candidate\.product \|\| pendingId === candidate\.id/);
assert.match(route, /p_quote_x_url: post\.quote_x_url \|\| post\.source_x_url/);
assert.match(route, /recorded_from: "myfans_post_execution"/);
assert.match(refresh, /last_processed_at/);
assert.match(refresh, /age >= 14/);

console.log("myfans growth loop contract: ok");
