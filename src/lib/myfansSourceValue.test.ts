import assert from "node:assert/strict";
import { evaluateMyfansSourceValue } from "./myfansSourceValue.ts";

const fresh = new Date().toISOString();
const shortConcrete = evaluateMyfansSourceValue({ text: "新作、階段から表情が変わる。", collectedAt: fresh, mediaType: "none" });
assert.equal(shortConcrete.verdict, "PASS");
assert.ok(shortConcrete.reactionAngles.includes("contrast"));

const promo = evaluateMyfansSourceValue({ text: "新商品発売中！詳しくはリンクから購入できます。", collectedAt: fresh });
assert.equal(promo.verdict, "LOW_SOURCE_VALUE");

const visualDependent = evaluateMyfansSourceValue({ text: "雰囲気がすごい", collectedAt: fresh, mediaType: "image", mediaPermalink: null });
assert.equal(visualDependent.verdict, "LOW_SOURCE_VALUE");
const verifiedVisual = evaluateMyfansSourceValue({ text: "雰囲気がすごい", collectedAt: fresh, mediaType: "image", mediaPermalink: "https://x.com/a/status/1/photo/1", quoteVisualReady: true });
assert.equal(verifiedVisual.verdict, "PASS");

const metrics = evaluateMyfansSourceValue({ text: "100000 5000 300", collectedAt: fresh, views: 100000 });
assert.equal(metrics.verdict, "LOW_SOURCE_VALUE");

const stale = evaluateMyfansSourceValue({ text: "新作、公開されて反応が分かれる。", collectedAt: new Date(Date.now() - 20 * 86_400_000).toISOString() });
assert.equal(stale.verdict, "LOW_SOURCE_VALUE");

const shortScore = evaluateMyfansSourceValue({ text: "新作、階段から表情が変わる。", collectedAt: fresh }).score;
const longPromoScore = promo.score;
assert.ok(shortScore > longPromoScore);
