import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/admin/myfans/page.tsx", "utf8");
const server = fs.readFileSync("src/lib/myfansMarketWinnerServer.ts", "utf8");
const route = fs.readFileSync("src/app/api/admin/myfans/market-winner/generate/route.ts", "utf8");
const forms = fs.readFileSync("src/app/admin/myfans/MyfansAdminForms.tsx", "utf8");

assert.match(page, /readMarketWinnerOpportunities/);
assert.doesNotMatch(page, /buildMarketWinnerOpportunities/);
assert.match(page, /Source候補を更新/);
assert.match(page, /Winner候補を生成・更新/);
assert.match(page, /4×3を再評価・保存/);
assert.match(page, /strategy\.strategyType === "SOURCE" && <QuoteRefreshBatchPanel/);
assert.match(server, /from\("myfans_market_opportunities"\)\s*\.select/);
assert.match(server, /\.in\("status", \["candidate", "selected", "held"\]\)/);
assert.match(server, /export async function readMarketWinnerOpportunities/);
assert.match(route, /export async function POST/);
assert.match(route, /isAdminRequest/);
assert.match(route, /strategyType !== "MARKET_WINNER"/);
assert.match(route, /buildMarketWinnerOpportunities/);
assert.match(forms, /\/api\/admin\/myfans\/market-winner\/generate/);
assert.match(forms, /disabled=\{pending\}/);

console.log("myfans market winner UI contract: ok");
