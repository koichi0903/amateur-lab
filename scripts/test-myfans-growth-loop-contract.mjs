import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const board = fs.readFileSync(new URL("src/app/admin/myfans/XExecutionBoard.tsx", root), "utf8");
const candidateForm = fs.readFileSync(new URL("src/app/admin/myfans/myfansExecutionCandidateForm.ts", root), "utf8");
const candidateCard = fs.readFileSync(new URL("src/app/admin/myfans/MyfansExecutionCandidateCard.tsx", root), "utf8");
const postActions = fs.readFileSync(new URL("src/lib/myfans/myfansAdminPostActions.ts", root), "utf8");
const refresh = fs.readFileSync(new URL("src/app/api/admin/myfans/quote-refresh/route.ts", root), "utf8");
const recommendations = fs.readFileSync(new URL("src/lib/myfans/myfansTargetedCreatorRecommendations.ts", root), "utf8");

assert.match(candidateForm, /formData\.set\("quote_x_url", candidate\.quoteXUrl \|\| candidate\.sourceXUrl\)/);
assert.match(candidateForm, /formData\.set\("global_content_fingerprint", candidate\.globalContentFingerprint\)/);
assert.match(candidateForm, /attribution:\s*\{[\s\S]*source_author: candidate\.sourceAuthorLabel/);
assert.match(candidateCard, /disabled=\{saved \|\| pendingId === candidate\.id \|\| Boolean\(saveBlockReason\)\}/);
assert.doesNotMatch(board, /disabled=\{!selected \|\| !candidate\.product \|\| pendingId === candidate\.id/);
assert.match(postActions, /p_quote_x_url: post\.quote_x_url \|\| post\.source_x_url/);
assert.match(postActions, /recorded_from: "myfans_post_execution"/);
assert.match(refresh, /last_processed_at/);
assert.match(recommendations, /age >= 14/);

console.log("myfans growth loop contract: ok");
