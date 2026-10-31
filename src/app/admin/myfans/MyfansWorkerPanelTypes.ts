export type QuoteRefreshProgress = {
  job: {
    id: number;
    status: string;
    total_creators: number;
    processed_creators: number;
    success_creators: number;
    failed_creators: number;
    batch_size: number;
    collection_cycle_no?: number;
    cursor_before_order?: number;
    cursor_after_order?: number | null;
    cycle_completed?: boolean;
    accounts_processed?: number;
    complete_threads_found?: number;
    candidates_saved?: number;
    no_match?: number;
    excluded_no_posts?: number;
    excluded_private?: number;
    retryable_errors?: number;
    collection_session_id?: string | null;
    collection_run_token?: string | null;
    launch_mode?: string | null;
    collector_version?: string | null;
    last_error: string | null;
  } | null;
  skippedCreators?: number;
  summary?: {
    processed: number; success: number; failed: number; blocked: number; skipped: number;
    accounts_processed?: number; profile_scan_ok?: number; status_navigation_attempted?: number;
    status_threads_observed?: number; fully_observed?: number; complete_threads_found?: number; candidates_saved?: number;
    no_match?: number; retryable?: number; excluded?: number;
  };
  items: Array<{
    id: number;
    creator_x_url: string;
    status: string;
    attempts: number;
    collected_count: number;
    top_score: number | null;
    error: string | null;
    processed_at?: string | null;
    collection_state?: string | null;
    myfans_creators?: { display_name?: string } | { display_name?: string }[] | null;
  }>;
  error?: string;
};

export type CompanionBridgeStatus = {
  scriptInjected: boolean;
  runtimeConnected: boolean;
  workerStatus: string;
  bridgeVersion: string | null;
  workerVersion: string | null;
  lastAckAt: string | null;
  message: string;
  identity?: { job_id?: number; collection_session_id?: string; run_token?: string; collector_version?: string } | null;
};

export type VisualVerificationProgress = {
  checked: number;
  verified: number;
  partial: number;
  unavailable: number;
  error?: string;
};

export type VisualQueueState = {
  job: {
    id: number;
    status: string;
    total_sources: number;
    processed_sources: number;
    verified_count: number;
    partial_count: number;
    unavailable_count: number;
    stopped_reason: string | null;
    analyzer_version: string | null;
  } | null;
  items?: Array<{ status: string }>;
};
