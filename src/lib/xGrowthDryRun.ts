export function getXGrowthPersistencePlan(readOnlyDryRun: boolean, includeDeferred: boolean) {
  return {
    persistTopPicks: !readOnlyDryRun,
    runDeferredWrites: includeDeferred && !readOnlyDryRun,
  };
}
