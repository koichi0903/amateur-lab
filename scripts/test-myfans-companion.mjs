import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const companion = path.join(root, "public", "myfans-companion");
const manifest = JSON.parse(fs.readFileSync(path.join(companion, "manifest.json"), "utf8"));
const background = fs.readFileSync(path.join(companion, "background.js"), "utf8");
const bridge = fs.readFileSync(path.join(companion, "myfans-admin-bridge.js"), "utf8");
const popup = fs.readFileSync(path.join(companion, "popup.js"), "utf8");

assert.match(manifest.version, /^0\.1\.\d+$/);
assert.match(background, /chrome\.runtime\.getManifest\(\)\.version/);
assert.match(bridge, /chrome\.runtime\.getManifest\(\)\.version/);
assert.match(background, /resultsが空でした/);
assert.match(background, /resultがundefinedでした/);
assert.match(background, /resultをJSON化できませんでした/);
assert.match(background, /requireResult: true/);
assert.match(background, /frameId === 0/);
assert.match(popup, /blocked \$\{/);

const normalize = (value) => value === undefined ? { ok: false, reason: "undefined" } : JSON.parse(JSON.stringify(value));
assert.deepEqual(normalize(undefined), { ok: false, reason: "undefined" });
assert.deepEqual(normalize({ ok: true, sourceXHandle: "creator", sourceStatusUrl: "https://x.com/creator/status/1" }), { ok: true, sourceXHandle: "creator", sourceStatusUrl: "https://x.com/creator/status/1" });

console.log(`Myfans Companion checks passed (manifest ${manifest.version})`);
