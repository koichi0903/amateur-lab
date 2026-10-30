export type ParsedMyfansAffiliateText = {
  creator: {
    displayName: string;
    myfansUrl: string;
    activityNote: string;
  };
  product: {
    title: string;
    productUrl: string;
    affiliateUrl: string;
    price: number;
    rewardRate: number;
    likesCount: number;
    savesCount: number;
    selectionReason: string;
  };
};

type ParsedUrls = { affiliateUrl: string; productUrl: string; creatorUrl: string };
type CreatorInfo = { creatorName: string; handle: string; myfansUrl: string };
type ProductMetrics = { price: number; rewardRate: number; likesCount: number; savesCount: number; followersCount: number; postsCount: number };

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

function urlsFromLines(lines: string[]): ParsedUrls {
  return {
    affiliateUrl: firstUrl(lines, /https?:\/\/(?:www\.)?(?:mfco\.link|affiliate\.myfans\.jp|link\.affiliate\.myfans\.jp)\/[^\s"'<>]+/),
    productUrl: firstUrl(lines, /https?:\/\/(?:www\.)?myfans\.jp\/posts\/[^\s"'<>]+/),
    creatorUrl: firstUrl(lines, /https?:\/\/(?:www\.)?myfans\.jp\/(?!posts\/)[^\s"'<>]+/),
  };
}

function creatorFromText(normalized: string, lines: string[], creatorUrl: string): CreatorInfo {
  const handleMatch = normalized.match(/@([A-Za-z0-9_]+)/) ?? creatorUrl.match(/myfans\.jp\/([A-Za-z0-9_]+)/);
  const handle = handleMatch?.[1] ?? "";
  const handleLineIndex = handle ? lines.findIndex((line) => line.includes(`@${handle}`) || line.includes(`/notify/${handle}`)) : -1;
  const previousLine = handleLineIndex > 0 ? lines[handleLineIndex - 1] : "";
  const creatorName = previousLine && !previousLine.startsWith("http")
    ? previousLine
    : lines.find((line) => line && !line.startsWith("http") && !line.startsWith("@") && !/myfans|ログイン|dashboard/i.test(line)) ?? handle;
  return { creatorName, handle, myfansUrl: creatorUrl || (handle ? `https://myfans.jp/${handle}` : "") };
}

function productMetrics(normalized: string, lines: string[]): ProductMetrics {
  return {
    price: lines.reduce((max, line) => Math.max(max, yenToNumber(line)), 0),
    rewardRate: normalized.includes("売上の全額") ? 100 : percentToNumber(normalized),
    likesCount: countBeforeLabel(normalized, "いいね"),
    savesCount: countBeforeLabel(normalized, "保存"),
    followersCount: countBeforeLabel(normalized, "フォロワー"),
    postsCount: countBeforeLabel(normalized, "投稿"),
  };
}

function looksLikeTitle(line: string, creatorName: string) {
  if (!line || line === creatorName) return false;
  if (/^@/.test(line) || /^https?:\/\//.test(line)) return false;
  if (/[¥￥]|報酬|フォロワー|投稿|いいね|保存|コピー|ログイン|dashboard|myfansアフィリエイト/.test(line)) return false;
  return line.length >= 6;
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

function validateInput(lines: string[], creatorName: string, handle: string, productUrl: string, affiliateUrl: string) {
  if (!lines.length) throw new Error("myfans管理画面からコピーしたテキストを貼り付けてください。");
  if (!creatorName && !handle) throw new Error("クリエイター名または@IDを読み取れませんでした。");
  if (!productUrl && !affiliateUrl) {
    throw new Error("商品URLまたはアフィリンクを読み取れませんでした。myfansの商品詳細か最近生成したURLの部分も一緒にコピーしてください。");
  }
}

export function parseMyfansAffiliateText(rawText: string): ParsedMyfansAffiliateText {
  const normalized = clean(rawText);
  const lines = normalized.split(/\r?\n/).map(clean).filter(Boolean);
  if (!lines.length) validateInput(lines, "", "", "", "");

  const urls = urlsFromLines(lines);
  const creator = creatorFromText(normalized, lines, urls.creatorUrl);
  validateInput(lines, creator.creatorName, creator.handle, urls.productUrl, urls.affiliateUrl);
  const metrics = productMetrics(normalized, lines);
  return {
    creator: {
      displayName: creator.creatorName || creator.handle,
      myfansUrl: creator.myfansUrl,
      activityNote: [metrics.followersCount ? `${metrics.followersCount}フォロワー` : "", metrics.postsCount ? `${metrics.postsCount}投稿` : ""].filter(Boolean).join(" / "),
    },
    product: {
      title: inferTitle(lines, creator.creatorName, urls.productUrl, urls.affiliateUrl),
      productUrl: urls.productUrl || urls.affiliateUrl,
      affiliateUrl: urls.affiliateUrl,
      price: metrics.price,
      rewardRate: metrics.rewardRate,
      likesCount: metrics.likesCount,
      savesCount: metrics.savesCount,
      selectionReason: "myfansアフィリエイト管理画面のコピー内容から登録。フォロワー0期のX投稿実行ボードで検証対象にする候補。",
    },
  };
}
