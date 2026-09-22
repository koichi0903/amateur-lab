import assert from "node:assert/strict";
import { canonicalMyfansXHandle, exactMyfansCreatorIds, resolveExactMyfansCreator, resolveExactMyfansProductId } from "./myfansAuthorMatch";

assert.equal(canonicalMyfansXHandle("@FMP369"), "fmp369");
assert.equal(canonicalMyfansXHandle("https://x.com/fmp369/?utm_source=x"), "fmp369");
assert.equal(canonicalMyfansXHandle("https://twitter.com/Fmp369"), "fmp369");
assert.deepEqual(exactMyfansCreatorIds([{ id: 44, creator_x_url: "https://x.com/fmp369", source_x_handle: "@fmp369" }], "FMP369"), [44]);
assert.deepEqual(resolveExactMyfansCreator([{ id: 44, creator_x_url: "https://x.com/fmp369", source_x_handle: "fmp369" }], "@FMP369"), { creatorId: 44, status: "exact" });
assert.deepEqual(resolveExactMyfansCreator([{ id: 44, creator_x_url: "https://x.com/fmp369" }, { id: 45, source_x_handle: "@FMP369" }], "fmp369"), { creatorId: null, status: "ambiguous" });
assert.deepEqual(resolveExactMyfansCreator([{ id: 44, creator_x_url: "https://x.com/fmp369" }, { id: 45, source_x_handle: "@other" }], "fmp369x"), { creatorId: null, status: "unresolved" });
assert.equal(resolveExactMyfansProductId([{ id: 77, creator_id: 44, quote_candidate_x_url: "https://x.com/other/status/9" }], 44, "https://x.com/fmp369/status/1"), null);
assert.equal(resolveExactMyfansProductId([{ id: 77, creator_id: 44, quote_candidate_x_url: "https://x.com/fmp369/status/1" }], 44, "https://x.com/fmp369/status/1?utm_source=x"), 77);

console.log("Myfans author matching checks passed");
