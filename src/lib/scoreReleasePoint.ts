const NEW_RELEASE_POINT_THRESHOLDS = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150] as const;

export function calculateNewReleasePoint(releaseDate: string | null, now = new Date()) {
  if (!releaseDate) return 0;

  const release = new Date(releaseDate);
  const daysFromRelease = Math.floor(
    (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysFromRelease < 0) return 0;

  const thresholdIndex = NEW_RELEASE_POINT_THRESHOLDS.findIndex(
    (threshold) => daysFromRelease <= threshold,
  );
  return thresholdIndex < 0 ? 0 : 10 - thresholdIndex;
}
