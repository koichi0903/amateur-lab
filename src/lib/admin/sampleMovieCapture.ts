export type SampleMovieCaptureState = {
  stage: string | null | undefined;
  sampleMovieUrl: string | null | undefined;
  sampleMovieCheckedAt: string | null | undefined;
  isNewRegistration?: boolean;
  promotedFromReserved?: boolean;
};

/**
 * Decide whether a normal catalog pass must include the sample-movie check.
 * OLD is intentionally excluded; its seven-day backfill owns retry timing.
 */
export function shouldCaptureSampleMovie({
  stage,
  sampleMovieUrl,
  sampleMovieCheckedAt,
  isNewRegistration = false,
  promotedFromReserved = false,
}: SampleMovieCaptureState): boolean {
  if (isNewRegistration) return true;
  if (sampleMovieUrl) return false;
  if (promotedFromReserved) return true;

  return (
    (stage === "NEW" || stage === "SEMI_NEW") &&
    !sampleMovieCheckedAt
  );
}

export type SampleMovieOutcome =
  | { status: "found"; url: string; checkedAt: string }
  | { status: "confirmed-none"; checkedAt: string }
  | { status: "failed-or-unchecked" };

/** Return only safe DB fields; failed checks deliberately produce no update. */
export function sampleMovieUpdateFor(outcome: SampleMovieOutcome): {
  sample_movie_url?: string;
  sample_movie_checked_at?: string;
} | null {
  if (outcome.status === "failed-or-unchecked") return null;
  if (outcome.status === "found") {
    return {
      sample_movie_url: outcome.url,
      sample_movie_checked_at: outcome.checkedAt,
    };
  }
  return { sample_movie_checked_at: outcome.checkedAt };
}
