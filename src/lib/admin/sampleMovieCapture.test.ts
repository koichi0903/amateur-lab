import assert from "node:assert/strict";
import test from "node:test";

import { sampleMovieUpdateFor, shouldCaptureSampleMovie } from "./sampleMovieCapture";

const state = (
  overrides: Partial<Parameters<typeof shouldCaptureSampleMovie>[0]> = {},
) => ({
  stage: "NEW",
  sampleMovieUrl: null,
  sampleMovieCheckedAt: null,
  ...overrides,
});

test("new NEW and RESERVED registrations always reach capture", () => {
  assert.equal(shouldCaptureSampleMovie(state({ isNewRegistration: true })), true);
  assert.equal(
    shouldCaptureSampleMovie(state({ stage: "RESERVED", isNewRegistration: true })),
    true,
  );
});

test("a RESERVED to NEW promotion retries even after an earlier no-movie check", () => {
  assert.equal(
    shouldCaptureSampleMovie(
      state({ stage: "NEW", sampleMovieCheckedAt: "2026-09-01T00:00:00Z", promotedFromReserved: true }),
    ),
    true,
  );
});

test("unchecked NEW and SEMI_NEW works are captured, but checked NEW works are not", () => {
  assert.equal(shouldCaptureSampleMovie(state()), true);
  assert.equal(shouldCaptureSampleMovie(state({ stage: "SEMI_NEW" })), true);
  assert.equal(
    shouldCaptureSampleMovie(state({ sampleMovieCheckedAt: "2026-09-01T00:00:00Z" })),
    false,
  );
  assert.equal(shouldCaptureSampleMovie(state({ sampleMovieUrl: "https://official/sample.mp4" })), false);
});

test("OLD bulk updates never force capture", () => {
  assert.equal(shouldCaptureSampleMovie(state({ stage: "OLD" })), false);
  assert.equal(shouldCaptureSampleMovie(state({ stage: "DISCONTINUED" })), false);
});

test("capture outcome semantics keep failures retryable and preserve non-null safety", () => {
  const checkedAt = "2026-09-30T00:00:00Z";
  assert.equal(sampleMovieUpdateFor({ status: "failed-or-unchecked" }), null);
  assert.deepEqual(
    sampleMovieUpdateFor({ status: "confirmed-none", checkedAt }),
    { sample_movie_checked_at: checkedAt },
  );
  assert.deepEqual(
    sampleMovieUpdateFor({ status: "found", url: "https://official/sample.mp4", checkedAt }),
    { sample_movie_url: "https://official/sample.mp4", sample_movie_checked_at: checkedAt },
  );
});
