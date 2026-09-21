(() => {
  const state = {
    successPatch(candidatesCount, payload = null) {
      return {
        finalStatus: payload?.ok === false ? (payload?.retryable === false ? "failed" : "retryable") : "success",
        errorCode: payload?.ok === false ? (payload?.errorCode || "REMOTE_REJECTED") : null,
        lastError: payload?.ok === false ? (payload?.error || "保存側で処理できませんでした。") : null,
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
