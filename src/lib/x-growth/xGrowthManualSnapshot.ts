export type ManualSnapshotInsert = {
  account_handle: string;
  x_post_log_id: number;
  post_key: string;
  snapshot_age: "24h";
  captured_at: string;
  source: "manual";
  impressions: number;
  site_visits: number;
  affiliate_clicks: number;
  notes: string;
};

export function buildManualSnapshotInsert({
  account,
  postId,
  postKey,
  capturedAt,
  impressions,
  siteVisits,
  affiliateClicks,
  ageHours,
}: {
  account: string;
  postId: number;
  postKey: string;
  capturedAt: Date;
  impressions: number;
  siteVisits: number | null;
  affiliateClicks: number | null;
  ageHours: number;
}): ManualSnapshotInsert {
  return {
    account_handle: account,
    x_post_log_id: postId,
    post_key: postKey,
    snapshot_age: "24h",
    captured_at: capturedAt.toISOString(),
    source: "manual",
    impressions,
    site_visits: siteVisits ?? 0,
    affiliate_clicks: affiliateClicks ?? 0,
    notes: `X画面の閲覧数を手入力。投稿から${ageHours.toFixed(2)}時間後に取得。X APIは使用していません。`,
  };
}
