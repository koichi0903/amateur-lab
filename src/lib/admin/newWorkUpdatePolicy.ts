export function shouldSkipUnchangedNewWorkUpdate(input: {
  playwrightStatus: string | null;
  databasePrice: number | null;
  latestPrice: number | null;
  captureSampleMovie: boolean;
}): boolean {
  return input.playwrightStatus !== "PENDING"
    && !input.playwrightStatus?.startsWith("UNAVAILABLE_")
    && input.databasePrice != null
    && input.latestPrice != null
    && input.databasePrice === input.latestPrice
    && !input.captureSampleMovie;
}
