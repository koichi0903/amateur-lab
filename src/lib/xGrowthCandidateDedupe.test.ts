import assert from "node:assert/strict";
import test from "node:test";
import { candidateDedupeKey, candidateMediaDedupeKey, isDistinctCandidate } from "./xGrowthOS";

const candidate = (overrides: Record<string, unknown> = {}) => ({
  workId: 1,
  productId: "p1",
  sampleMovieUrl: null,
  mediaAsset: null,
  ...overrides,
});

test("candidate identity prioritizes media asset, sample URL, then work", () => {
  assert.equal(candidateDedupeKey(candidate({ mediaAsset: { id: 42 }, sampleMovieUrl: "https://same" })), "media_asset:42");
  assert.equal(candidateDedupeKey(candidate({ sampleMovieUrl: "https://same" })), "sample_movie_url:https://same");
  assert.equal(candidateDedupeKey(candidate()), "work:1");
});

test("same slot rejects duplicate media asset, sample URL, and work", () => {
  assert.equal(isDistinctCandidate(candidate({ mediaAsset: { id: 42 }, sampleMovieUrl: "https://a" }), []), true);
  assert.equal(isDistinctCandidate(candidate({ workId: 2, mediaAsset: { id: 42 }, sampleMovieUrl: "https://b" }), [candidate({ mediaAsset: { id: 42 }, sampleMovieUrl: "https://a" })]), false);
  assert.equal(isDistinctCandidate(candidate({ workId: 2, sampleMovieUrl: "https://a" }), [candidate({ workId: 3, sampleMovieUrl: "https://a" })]), false);
  assert.equal(isDistinctCandidate(candidate({ workId: 1, sampleMovieUrl: "https://b" }), [candidate({ workId: 1, sampleMovieUrl: "https://a" })]), false);
});

test("different media can reuse a work only when caller explicitly allows cross-slot reuse", () => {
  const first = candidate({ mediaAsset: { id: 1 }, sampleMovieUrl: "https://a" });
  const second = candidate({ mediaAsset: { id: 2 }, sampleMovieUrl: "https://b" });
  assert.equal(candidateMediaDedupeKey(first) === candidateMediaDedupeKey(second), false);
  assert.equal(isDistinctCandidate(second, [first]), false);
});
