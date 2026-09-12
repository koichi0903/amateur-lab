import { calculateMyfansSelectionScore, myfansLaunchPriority } from "@/lib/myfansScore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_MEDIA_NAME = "@lumi_reviw";

function clean(value: string) {
  return value.normalize("NFKC").trim();
}

function yenToNumber(value: string) {
  const match = clean(value).match(/[¥￥]\s*([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function percentToNumber(value: string) {
  const match = clean(value).match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : 0;
}

function countBeforeLabel(text: string, label: string) {
  const match = clean(text).match(new RegExp(`([\\d,]+)\\s*${label}`));
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function firstUrl(lines: string[], matcher: RegExp) {
  for (const line of lines) {
    const match = line.match(matcher);
    if (match) return match[0];
  }
  return "";
}

function inferTitle(lines: string[], creatorName: string, productUrl: string, affiliateUrl: string) {
  const urlIndex = productUrl ? lines.findIndex((line) => line.includes(productUrl)) : -1;
  if (urlIndex >= 0) {
    const nearby = lines.slice(urlIndex + 1, urlIndex + 6).find((line) => looksLikeTitle(line, creatorName));
    if (nearby) return nearby;
  }

  const affiliateIndex = affiliateUrl ? lines.findIndex((line) => line.includes(affiliateUrl)) : -1;
  if (affiliateIndex > 0) {
    const nearby = [...lines.slice(Math.max(0, affiliateIndex - 5), affiliateIndex)].reverse().find((line) => looksLikeTitle(line, creatorName));
    if (nearby) return nearby;
  }

  return lines.find((line) => looksLikeTitle(line, creatorName)) ?? `${creatorName || "myfans"}の投稿`;
}

function looksLikeTitle(line: string, creatorName: string) {
  if (!line || line === creatorName) return false;
  if (/^@/.test(line) || /^https?:\/\//.test(line)) return false;
  if (/[¥￥]|報酬|フォロワー|投稿|いいね|保存|コピー|ログイン|dashboard|myfansアフィリエイト/.test(line)) return false;
  return line.length >= 6;
}

export function parseMyfansAffiliateText(rawText: string) {
  const normalized = clean(rawText);
  const lines = normalized.split(/\r?\n/).map(clean).filter(Boolean);
  if (!lines.length) throw new Error("myfans管理画面からコピーしたテキストを貼り付けてください。");

  const affiliateUrl = firstUrl(lines, /https?:\/\/(?:www\.)?(?:mfco\.link|affiliate\.myfans\.jp|link\.affiliate\.myfans\.jp)\/[^\s"'<>]+/);
  const productUrl = firstUrl(lines, /https?:\/\/(?:www\.)?myfans\.jp\/posts\/[^\s"'<>]+/);
  const creatorUrl = firstUrl(lines, /https?:\/\/(?:www\.)?myfans\.jp\/(?!posts\/)[^\s"'<>]+/);
  const handleMatch = normalized.match(/@([A-Za-z0-9_]+)/) ?? creatorUrl.match(/myfans\.jp\/([A-Za-z0-9_]+)/);
  const handle = handleMatch?.[1] ?? "";
  const handleLineIndex = handle ? lines.findIndex((line) => line.includes(`@${handle}`) || line.includes(`/notify/${handle}`)) : -1;
  const creatorName = handleLineIndex > 0 && !lines[handleLineIndex - 1].startsWith("http")
    ? lines[handleLineIndex - 1]
    : lines.find((line) => line && !line.startsWith("http") && !line.startsWith("@") && !/myfans|ログイン|dashboard/i.test(line)) ?? handle;
  const price = lines.reduce((max, line) => Math.max(max, yenToNumber(line)), 0);
  const rewardRate = normalized.includes("売上の全額") ? 100 : percentToNumber(normalized);
  const likesCount = countBeforeLabel(normalized, "いいね");
  const savesCount = countBeforeLabel(normalized, "保存");
  const followersCount = countBeforeLabel(normalized, "フォロワー");
  const postsCount = countBeforeLabel(normalized, "投稿");
  const title = inferTitle(lines, creatorName, productUrl, affiliateUrl);

  if (!creatorName && !handle) throw new Error("クリエイター名または@IDを読み取れませんでした。");
  if (!productUrl && !affiliateUrl) {
    throw new Error("商品URLまたはアフィリンクを読み取れませんでした。myfansの商品詳細か最近生成したURLの部分も一緒にコピーしてください。");
  }

  return {
    creator: {
      displayName: creatorName || handle,
      myfansUrl: creatorUrl || (handle ? `https://myfans.jp/${handle}` : ""),
      activityNote: [followersCount ? `${followersCount}フォロワー` : "", postsCount ? `${postsCount}投稿` : ""].filter(Boolean).join(" / "),
    },
    product: {
      title,
      productUrl: productUrl || affiliateUrl,
      affiliateUrl,
      price,
      rewardRate,
      likesCount,
      savesCount,
      selectionReason: "myfansアフィリエイト管理画面のコピー内容から登録。フォロワー0期のX投稿実行ボードで検証対象にする候補。",
    },
  };
}

export async function saveMyfansAffiliateTextImport(rawText: string) {
  const parsed = parseMyfansAffiliateText(rawText);
  const creatorRecord = {
    display_name: parsed.creator.displayName,
    myfans_url: parsed.creator.myfansUrl,
    x_url: "",
    genre: "",
    activity_note: parsed.creator.activityNote,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const creatorQuery = creatorRecord.myfans_url
    ? supabaseAdmin.from("myfans_creators").upsert(creatorRecord, { onConflict: "myfans_url", ignoreDuplicates: false }).select("id").single()
    : supabaseAdmin.from("myfans_creators").insert(creatorRecord).select("id").single();
  const { data: creator, error: creatorError } = await creatorQuery;
  if (creatorError) throw creatorError;

  const selectionScore = calculateMyfansSelectionScore({
    price: parsed.product.price,
    rewardRate: parsed.product.rewardRate,
    planSignupReward: 0,
    recurringRewardRate: 0,
    popularityRank: null,
    likesCount: parsed.product.likesCount,
    savesCount: parsed.product.savesCount,
    isNew: false,
    hasAffiliateUrl: Boolean(parsed.product.affiliateUrl),
    hasApprovedMedia: true,
  });
  const productRecord = {
    creator_id: creator.id,
    title: parsed.product.title,
    product_url: parsed.product.productUrl,
    affiliate_url: parsed.product.affiliateUrl,
    source_x_url: "",
    genre: "",
    product_type: "single",
    status: "candidate",
    price: parsed.product.price,
    reward_rate: parsed.product.rewardRate,
    estimated_reward: Math.round(parsed.product.price * (parsed.product.rewardRate / 100)),
    plan_signup_reward: 0,
    recurring_reward_rate: 0,
    popularity_rank: null,
    likes_count: parsed.product.likesCount,
    saves_count: parsed.product.savesCount,
    is_new: false,
    selection_reason: parsed.product.selectionReason,
    notes: "",
    approved_media_name: DEFAULT_MEDIA_NAME,
    approved_media_url: "",
    affiliate_media_id: "",
    selection_score: selectionScore,
    launch_priority: myfansLaunchPriority(selectionScore),
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: product, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .upsert(productRecord, { onConflict: "product_url", ignoreDuplicates: false })
    .select("id")
    .single();
  if (productError) throw productError;

  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "product",
    entity_id: product.id,
    action: "affiliate_text_import",
    summary: productRecord.title,
    metadata: { creator_id: creator.id, selectionScore },
  });

  return { creatorId: creator.id, productId: product.id, title: productRecord.title };
}
