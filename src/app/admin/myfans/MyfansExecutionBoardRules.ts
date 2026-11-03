import type { buildMyfansExecutionBoard } from "@/lib/myfansXExecution";
import type { MyfansXPost } from "@/lib/myfansAnalytics";
import { myfansAffiliateLinkStatus, myfansAffiliateLinkStatusLabel, normalizeMyfansAffiliateUrl } from "@/lib/myfansAffiliateLink";

export type ExecutionCandidate = ReturnType<typeof buildMyfansExecutionBoard>["candidates"][number];

export function publishBody(candidate: ExecutionCandidate) {
  const sourceLinks = [candidate.quoteXUrl || candidate.sourceXUrl, candidate.mediaPermalink]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const uniqueSourceLinks = [...new Set(sourceLinks)];
  if (!uniqueSourceLinks.length) return candidate.body;
  const lines = candidate.body.split(/\n+/).map((line) => line.trim()).filter((line) => !uniqueSourceLinks.includes(line));
  return [...lines, ...uniqueSourceLinks].join("\n\n");
}

export function needsFreshAffiliateLink(candidate: ExecutionCandidate) {
  return candidate.linkStrategy === "reply_link" || candidate.linkStrategy === "body_link";
}

export function canUseAffiliateLink(candidate: ExecutionCandidate) {
  if (!candidate.product || !needsFreshAffiliateLink(candidate)) return true;
  const status = myfansAffiliateLinkStatus(candidate.product);
  return status === "valid" || status === "expiring_soon";
}

export function linkStrategyLabel(candidate: ExecutionCandidate) {
  if (candidate.linkStrategy === "reply_link") return "自己リプでリンク";
  if (candidate.linkStrategy === "body_link") return "本文にリンク";
  if (candidate.linkStrategy === "profile_cta") return "プロフィールへ誘導";
  return "リンクなし";
}

export function postModeLabel(candidate: ExecutionCandidate) {
  if (candidate.postMode === "quote_plus_reply_affiliate") return "引用 + 自己リプアフィ";
  if (candidate.postMode === "direct_affiliate") return "myfans直リンク";
  return "引用投稿";
}

export function sourceMediaTypeLabel(candidate: ExecutionCandidate) {
  if (candidate.sourceMediaType === "video") return "video";
  if (candidate.sourceMediaType === "image") return "image";
  return "none";
}

export function affiliateStatusLabel(candidate: ExecutionCandidate) {
  if (!candidate.product || !candidate.myfansCreator) return "myfans未紐付け";
  if (candidate.affiliateConnectionStatus === "source_product_mismatch") return "引用元とmyfans商品の同一性未確認";
  if (candidate.monetizableStatus === "linked_no_affiliate") return "紐付け済み / アフィ未作成";
  if (candidate.monetizableStatus === "linked_affiliate_ready") return "アフィ利用可能";
  if (!candidate.affiliateUrl) return "未作成";
  if (!normalizeMyfansAffiliateUrl(candidate.affiliateUrl)) return "正規mfco.linkではない";
  return myfansAffiliateLinkStatusLabel(myfansAffiliateLinkStatus(candidate.product));
}

export function monetizableStatusLabel(candidate: ExecutionCandidate) {
  if (candidate.monetizableStatus === "linked_affiliate_ready") return "アフィ利用可能";
  if (candidate.monetizableStatus === "linked_no_affiliate") return "紐付け済み / アフィ未作成";
  return "未紐付け";
}

export function quoteIntentUrl(candidate: ExecutionCandidate) {
  const url = candidate.quoteXUrl || candidate.sourceXUrl;
  const text = publishBody(candidate);
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}${url ? `&url=${encodeURIComponent(url)}` : ""}`;
}

export function postingSteps(candidate: ExecutionCandidate) {
  if (candidate.postMode === "quote_plus_reply_affiliate") {
    return ["Xで引用ポストを開く", "本文をコピーして引用投稿", "投稿後、自己リプに#PRとmfco.linkを貼る"];
  }
  if (candidate.postMode === "direct_affiliate") {
    return candidate.linkStrategy === "body_link"
      ? ["本文をコピー", "正規mfco.link入りで投稿", "OGP表示を確認"]
      : ["本文を投稿", "投稿後、自己リプに#PRとmfco.linkを貼る"];
  }
  return ["Xで引用ポストを開く", "本文をコピーして引用投稿", "メディアは再アップロードしない"];
}

const POST_RECORD_LEAK_PATTERNS = [
  /ブラウザでvisual/i,
  /推定報酬/,
  /報酬率/,
  /Quality Gate/i,
  /公開候補/,
  /候補です/,
  /登録情報でも/,
];

export const metricFields = [
  { name: "impressions", label: "表示回数", description: "Xで何回見られたか" },
  { name: "likes_count", label: "いいね", description: "この投稿についたいいね数" },
  { name: "reposts_count", label: "リポスト", description: "この投稿がリポストされた回数" },
  { name: "replies_count", label: "返信", description: "この投稿への返信数" },
  { name: "clicks", label: "リンククリック", description: "myfansリンクを押された回数" },
] as const;

function publicCopyLeakMatches(text: string) {
  return POST_RECORD_LEAK_PATTERNS.flatMap((pattern) => text.match(pattern)?.[0] ?? []);
}

function postTimestamp(post: MyfansXPost) {
  return new Date(post.posted_at ?? post.created_at).getTime();
}

function isConfirmedPostedPost(post: MyfansXPost) {
  return post.status === "posted" || Boolean(post.posted_at) || Boolean(post.x_post_url.trim());
}

function postDedupeKey(post: MyfansXPost) {
  const xPostUrl = post.x_post_url.trim();
  if (xPostUrl) return `url:${xPostUrl}`;
  if (post.planned_slot && post.creative_variant_id) return `slot:${post.planned_slot}:${post.creative_variant_id}`;
  return `id:${post.id}`;
}

export function dedupePostedPosts(posts: MyfansXPost[]) {
  return Array.from(
    posts
      .filter(isConfirmedPostedPost)
      .reduce((latestByKey, post) => {
        const key = postDedupeKey(post);
        const current = latestByKey.get(key);
        if (!current || postTimestamp(post) > postTimestamp(current)) latestByKey.set(key, post);
        return latestByKey;
      }, new Map<string, MyfansXPost>())
      .values(),
  ).sort((a, b) => postTimestamp(b) - postTimestamp(a));
}

export function isMetricsRecorded(post: MyfansXPost) {
  return Boolean(post.metrics_recorded_at);
}

export function postDisplayCopy(post: MyfansXPost) {
  const postedLeakMatches = publicCopyLeakMatches(post.body);
  if (postedLeakMatches.length) {
    return {
      label: "投稿時の本文（旧）",
      body: post.body,
      warning: `内部向け文言が含まれています。公開候補ではなく過去の保存本文として確認してください: ${postedLeakMatches.join(" / ")}`,
    };
  }

  return {
    label: "投稿時の本文",
    body: post.body,
    warning: null,
  };
}
