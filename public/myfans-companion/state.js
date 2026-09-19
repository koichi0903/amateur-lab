(() => {
  const state = {
    successPatch(candidatesCount) {
      return {
        finalStatus: "success",
        errorCode: null,
        lastError: null,
        failureDiagnostics: null,
        lastCandidatesCount: candidatesCount || 0,
      };
    },
    appendAttemptDiagnostic(current, entry) {
      const history = Array.isArray(current?.attemptDiagnostics) ? current.attemptDiagnostics : [];
      return [...history, entry].slice(-20);
    },
    isCompleted(job) {
      return job?.status === "completed"
        || (job && Number(job.processed_creators || 0) >= Number(job.total_creators || 0));
    },
  };
  globalThis.MyfansCompanionState = state;
})();
