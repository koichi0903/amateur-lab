export type UpdateWorkStatus = "updated" | "unchanged" | "unavailable_deferred";
export type PlaywrightUpdateResult = UpdateWorkStatus | "unavailable" | "sample_movie_missing";

export function resolveUpdateWorkStatus(
  playwrightResult: PlaywrightUpdateResult,
  metadataChanged: boolean,
): UpdateWorkStatus {
  if (playwrightResult === "unavailable_deferred") return "unavailable_deferred";
  if (metadataChanged || playwrightResult === "updated") return "updated";
  return "unchanged";
}
