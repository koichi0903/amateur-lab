(() => {
  const state = {
    SINGLE_TERMINAL_STATUSES: ["SUCCEEDED", "FAILED", "REPLAYED"],
    SINGLE_ACTIVE_STATUSES: ["STARTING", "SENDING", "ACCEPTED", "COLLECTING", "SAVING"],
    isSingleTerminalStatus(status) { return this.SINGLE_TERMINAL_STATUSES.includes(String(status || "")); },
    isSingleActiveStatus(status) { return this.SINGLE_ACTIVE_STATUSES.includes(String(status || "")); },
    isSameSingleRun(stateValue, runId) { return Boolean(runId && stateValue?.runId === runId); },
    ACTIVE_STATUSES: ["pending", "running", "paused"],
    TERMINAL_STATUSES: ["completed", "failed", "cancelled"],
    isActiveStatus(status) {
      return ["pending", "running", "paused"].includes(String(status || ""));
    },
    isTerminalStatus(status) {
      return ["completed", "failed", "cancelled"].includes(String(status || ""));
    },
    hasRunIdentity(value) {
      return Boolean(value?.job_id && value?.collection_session_id && value?.run_token && value?.collector_version);
    },
    identityMatches(stateValue, job, workerVersion) {
      const identity = stateValue?.identity || stateValue;
      return Boolean(job?.id && this.hasRunIdentity(identity) && identity.job_id === job.id && identity.collection_session_id === job.collection_session_id && identity.run_token === job.collection_run_token && identity.collector_version === job.collector_version && (!workerVersion || identity.collector_version === workerVersion));
    },
    isCurrentActiveRun(stateValue, job, workerVersion) {
      return Boolean(stateValue?.running === true && ["starting", "running", "scheduled"].includes(stateValue.status) && this.isActiveStatus(job?.status) && this.identityMatches(stateValue, job, workerVersion));
    },
    sanitizeForDisplay(stateValue, job, workerVersion) {
      if (this.isCurrentActiveRun(stateValue, job, workerVersion)) return { ...stateValue, current: true };
      if (job && this.isTerminalStatus(job.status)) return { job, status: "history", running: false, current: false, history: true };
      return { status: "idle", running: false, current: false, history: false };
    },
    shouldInvalidateStoredRun(settings, stateValue, workerVersion) {
      const identity = stateValue?.identity || stateValue;
      return Boolean((settings?.collectorVersion && settings.collectorVersion !== workerVersion) || (stateValue?.collectorVersion && stateValue.collectorVersion !== workerVersion) || (identity?.collector_version && identity.collector_version !== workerVersion) || (stateValue?.running === true && !this.hasRunIdentity(identity)));
    },
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
