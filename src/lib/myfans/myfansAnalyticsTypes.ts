export type MyfansCreator = {
  id: number;
  display_name: string;
  genre: string;
  myfans_url: string;
  x_url: string;
  creator_x_url?: string;
  source_x_handle?: string;
  latest_quote_x_url?: string;
  is_active: boolean;
  created_at: string;
};

export type MyfansProduct = {
  id: number;
  creator_id: number | null;
  approved_media_id?: number | null;
  title: string;
  product_url: string;
  genre: string;
  product_type: string;
  status: string;
  price: number;
  reward_rate: number;
  estimated_reward: number;
  plan_signup_reward: number;
  recurring_reward_rate: number;
  popularity_rank: number | null;
  likes_count: number;
  saves_count: number;
  is_new: boolean;
  source_x_url: string;
  creator_x_url?: string;
  quote_candidate_x_url?: string;
  affiliate_url: string;
  affiliate_url_generated_at?: string | null;
  affiliate_url_expires_at?: string | null;
  affiliate_url_source?: string | null;
  media_permission_status?: string;
  media_permission_note?: string;
  selection_reason: string;
  approved_media_name?: string;
  approved_media_url?: string;
  affiliate_media_id?: string;
  selection_score?: number;
  launch_priority?: string;
  created_at: string;
  myfans_creators?: Pick<MyfansCreator, "display_name"> | null;
};

export type MyfansDailyFunnelCreator = Pick<MyfansCreator, "id" | "x_url" | "creator_x_url">;
export type MyfansDailyFunnelProduct = Pick<
  MyfansProduct,
  | "id"
  | "creator_id"
  | "creator_x_url"
  | "status"
  | "product_url"
  | "approved_media_id"
  | "approved_media_name"
  | "affiliate_media_id"
> & {
  myfans_creators?: Pick<MyfansCreator, "myfans_url"> | null;
};
export type MyfansDailyFunnelInputs = {
  creators: MyfansDailyFunnelCreator[];
  products: MyfansDailyFunnelProduct[];
};

export type MyfansXPost = {
  id: number;
  product_id: number | null;
  post_type: string;
  status: string;
  body: string;
  self_reply: string;
  includes_pr: boolean;
  source_x_url: string;
  affiliate_url: string;
  selection_reason: string;
  scheduled_at: string | null;
  posted_at: string | null;
  x_post_url: string;
  x_post_id?: string;
  impressions: number;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  clicks?: number;
  growth_stage?: string;
  link_strategy?: string;
  cta_strategy?: string;
  creative_variant_id?: string;
  creative_strategy?: string;
  creative_reason?: string;
  card_payload?: Record<string, unknown>;
  ogp_check_required?: boolean;
  quote_x_url?: string;
  media_permission_status?: string;
  planned_slot?: string;
  objective?: string;
  approved_media_name?: string;
  approved_media_id?: number | null;
  pattern_id?: number | null;
  quote_candidate_id?: number | null;
  creator_id?: number | null;
  strategy_type?: "SOURCE" | "MARKET_WINNER" | null;
  global_content_fingerprint?: string | null;
  growth_score_snapshot?: number;
  revenue_score_snapshot?: number;
  creator_ltv_score_snapshot?: number;
  expected_reward_per_1000_impressions_snapshot?: number;
  metrics_sync_error?: string;
  metrics_recorded_at?: string | null;
  created_at: string;
  myfans_products?: Pick<MyfansProduct, "title" | "price" | "estimated_reward"> | null;
};

export type MyfansConversion = {
  id: number;
  approved_media_id?: number | null;
  product_id: number | null;
  x_post_id: number | null;
  conversion_type: string;
  occurred_at: string;
  sale_amount: number;
  reward_amount: number;
  reward_rate: number;
  source_file: string;
  myfans_products?: Pick<MyfansProduct, "title"> | null;
};

export type MyfansDailyMetric = {
  approved_media_id?: number | null;
  metric_date: string;
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  reward_amount: number;
};

export type MyfansApprovedMedia = {
  id: number;
  media_name: string;
  media_url: string;
  affiliate_media_id: string;
  status: string;
  notes: string;
  created_at: string;
  account_key?: string;
  strategy_type?: "SOURCE" | "MARKET_WINNER";
};

export type MyfansXAccountMetric = {
  id: number;
  metric_date: string;
  approved_media_id: number;
  followers_count: number;
  following_count: number | null;
  profile_visits: number;
  total_impressions: number;
  posts_count: number;
  likes: number;
  reposts: number;
  replies: number;
  affiliate_clicks: number;
  conversions: number;
  reward_amount: number;
  notes: string;
  myfans_approved_media?: Pick<MyfansApprovedMedia, "media_name"> | null;
};

export type MyfansAuditLog = {
  id: number;
  entity_type: string;
  entity_id: number | null;
  action: string;
  summary: string;
  created_at: string;
};

export type MyfansQuoteCandidate = {
  id: number;
  approved_media_id: number | null;
  creator_id: number | null;
  product_id: number | null;
  creator_x_url: string;
  source_x_handle: string;
  x_post_url: string;
  media_permalink?: string | null;
  media_type?: "image" | "video" | "none" | null;
  media_count?: number | null;
  quote_visual_ready?: boolean;
  media_permalink_verified_at?: string | null;
  media_permalink_validation_status?: string | null;
  visual_render_status?: "browser_visible" | "app_only" | "blocked" | "unknown" | null;
  visual_score?: number | null;
  posted_at: string | null;
  text_excerpt: string;
  views: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  bookmarks: number | null;
  has_image: boolean;
  has_video: boolean;
  is_pinned: boolean;
  is_reply: boolean;
  is_repost: boolean;
  is_quote: boolean;
  collected_at: string;
  score: number;
  score_reason: string;
  selected: boolean;
  creator_rank?: number | null;
  global_score?: number | null;
  global_rank?: number | null;
  last_used_at?: string | null;
  use_count?: number;
  cooldown_until?: string | null;
  selected_for_today?: boolean;
  visual_analysis_status?: "verified" | "partial" | "unavailable" | null;
  visual_analysis_json?: Record<string, unknown> | null;
  visual_analyzed_at?: string | null;
  visual_analyzer_version?: string | null;
  source_value_score?: number | null;
  source_value_verdict?: "PASS" | "LOW_SOURCE_VALUE" | null;
  source_value_reasons?: string[] | null;
  reaction_angles?: string[] | null;
  source_specificity?: number | null;
};

export type MyfansDailyPlanHistory = {
  id: number;
  plan_date: string;
  approved_media_id: number | null;
  revision?: number | null;
  strategy_json: Record<string, unknown> | null;
  updated_at?: string | null;
  evaluated_at?: string | null;
};

export type MyfansXGrowthDiagnosis =
  | "露出不足"
  | "露出はあるがプロフィール遷移不足"
  | "プロフィール遷移はあるがフォロー不足"
  | "フォローは増えるがクリック不足"
  | "クリックあり/CV不足"
  | "成果発生・最適化段階";

