async function collectFromPage() {
  const text = document.body.innerText || "";
  const reservedXHandles = new Set(["home", "explore", "search", "intent", "share", "i", "notifications", "messages", "settings", "login", "signup"]);
  const normalizeXProfileUrl = (value) => {
    try {
      const url = new URL(String(value || "").trim(), location.href);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (host !== "x.com" && host !== "twitter.com") return "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 1) return "";
      const handle = parts[0];
      if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return "";
      if (reservedXHandles.has(handle.toLowerCase())) return "";
      return `https://x.com/${handle}`;
    } catch {
      return "";
    }
  };
  const xHandleFromProfileUrl = (value) => {
    const url = normalizeXProfileUrl(value);
    return url ? `@${url.split("/").pop()}` : "";
  };
  const validAffiliateUrl = (value) => {
    const url = String(value || "").trim();
    return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+/.test(url) ? url : "";
  };
  const clickAndReadAffiliateUrl = async (button) => {
    if (!button) return "";
    const clipboard = navigator.clipboard;
    const originalWriteText = clipboard?.writeText?.bind(clipboard);
    const originalWrite = clipboard?.write?.bind(clipboard);
    let writtenText = "";
    const readClipboardItemText = async (item) => {
      try {
        const blob = await item.getType("text/plain");
        return await blob.text();
      } catch {
        return "";
      }
    };
    try {
      if (clipboard && originalWriteText) {
        clipboard.writeText = async (value) => {
          writtenText = String(value || "");
          return Promise.resolve();
        };
      }
      if (clipboard && originalWrite) {
        clipboard.write = async (items) => {
          for (const item of Array.from(items || [])) {
            const text = await readClipboardItemText(item);
            if (validAffiliateUrl(text)) writtenText = text;
          }
          return Promise.resolve();
        };
      }
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return validAffiliateUrl(writtenText);
    } catch {
      return "";
    } finally {
      if (clipboard && originalWriteText) clipboard.writeText = originalWriteText;
      if (clipboard && originalWrite) clipboard.write = originalWrite;
    }
  };
  const closestProductCard = (element) => {
    let current = element;
    while (current && current !== document.body) {
      if (
        current.querySelector?.('a[href*="myfans.jp/posts/"]') &&
        Array.from(current.querySelectorAll?.("button") || []).some((button) =>
          (button.innerText || button.textContent || "").includes("投稿のアフィURLのコピー")
        )
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return element.parentElement;
  };
  const findNumber = (patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return "";
  };
  const title = document.querySelector("h1")?.textContent || document.title.replace(/\s*\|.*$/, "");
  const links = Array.from(document.querySelectorAll("a")).map((link) => link.href).filter(Boolean);
  const xProfileLinks = links.map(normalizeXProfileUrl).filter(Boolean);
  const xStatusLinks = links.filter((href) => /^https:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+/.test(href));
  const sourceXHandle = xHandleFromProfileUrl(xProfileLinks[0]).replace(/^@/, "");
  const affiliateUrlFromText = validAffiliateUrl(text.match(/https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+/)?.[0]);
  const isCreatorSearchPage = location.hostname === "www.affiliate.myfans.jp" && location.pathname.startsWith("/affiliates/search/creators");
  const isCreatorDetailPage = /^\/affiliates\/search\/creators\/[^/]+$/.test(location.pathname);
  const isGeneratedCreatorPage = /^\/affiliates\/generated\/creators\/[^/]+$/.test(location.pathname);
  const productLinkElements = Array.from(document.querySelectorAll('a[href*="myfans.jp/posts/"]'));
  const productLinks = productLinkElements.map((link) => link.href).filter(Boolean);
  const copiedAffiliateUrlsByProductUrl = new Map();
  for (const link of productLinkElements.slice(0, 50)) {
    const card = closestProductCard(link);
    const button = Array.from(card?.querySelectorAll?.("button") || [])
      .find((button) => (button.innerText || button.textContent || "").includes("投稿のアフィURLのコピー"));
    copiedAffiliateUrlsByProductUrl.set(link.href, await clickAndReadAffiliateUrl(button));
  }
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const firstProductLinkText = document.querySelector('a[href*="myfans.jp/posts/"]')?.textContent?.trim() || "";
  const firstProductIndex = firstProductLinkText ? lines.findIndex((line) => line === firstProductLinkText) : -1;
  const firstProductSegment = firstProductIndex >= 0 ? lines.slice(firstProductIndex, firstProductIndex + 8) : [];
  const firstProductTitle = firstProductSegment[1] || "";
  const firstProductPrice = firstProductSegment.find((line) => /^[¥￥]\s*[\d,]+$/.test(line)) || "";
  const firstProductReward = firstProductSegment.find((line) => /単品購入[:：]\s*(?:売上の全額|[\d.]+%)/.test(line)) || "";
  const products = productLinks.slice(0, 50).map((href) => {
    const linkText = document.querySelector(`a[href="${href}"]`)?.textContent?.trim() || "";
    const index = linkText ? lines.findIndex((line) => line === linkText) : -1;
    const segment = index >= 0 ? lines.slice(index, index + 10) : [];
    return {
      productUrl: href,
      productTitle: segment[1] || linkText || title,
      affiliateUrl: copiedAffiliateUrlsByProductUrl.get(href) || "",
      price: segment.find((line) => /^[¥￥]\s*[\d,]+$/.test(line)) || "",
      rewardRate: segment.find((line) => /単品購入[:：]\s*(?:売上の全額|[\d.]+%)/.test(line)) || "",
      likesCount: segment.find((line) => /^[\d,.Kk]+$/.test(line)) || "",
      publishedAt: segment.find((line) => /\d+\s*(日|時間|分)前/.test(line)) || ""
    };
  }).filter((product, index, all) => product.productUrl && all.findIndex((item) => item.productUrl === product.productUrl) === index);
  const creators = Array.from(document.querySelectorAll('a[href*="/affiliates/search/creators/"]'))
    .filter((link) => !link.href.includes("/tab/"))
    .map((link) => {
      const lines = (link.innerText || link.textContent || "").split("\n").map((line) => line.trim()).filter(Boolean);
      const card = (() => {
        let current = link.parentElement;
        while (current && current !== document.body) {
          const hasSelf = Array.from(current.querySelectorAll("a[href]")).some((item) => item.href === link.href);
          const hasCreatorCount = Array.from(current.querySelectorAll('a[href*="/affiliates/search/creators/"]')).filter((item) => !item.href.includes("/tab/")).length;
          if (hasSelf && hasCreatorCount === 1) return current;
          current = current.parentElement;
        }
        return link.parentElement;
      })();
      const cardText = card?.innerText || link.innerText || "";
      const rates = Array.from(cardText.matchAll(/(単品販売|プラン加入)\s*([0-9.]+)\s*%/gs));
      const creatorXUrl = Array.from(card?.querySelectorAll?.("a[href]") || [])
        .map((item) => normalizeXProfileUrl(item.href))
        .find(Boolean) || "";
      return {
        displayName: lines[0] || "",
        myfansUrl: link.href,
        creatorXUrl,
        sourceXHandle: xHandleFromProfileUrl(creatorXUrl),
        followerCount: cardText.match(/([\d,.Kk]+)\s*フォロワー/)?.[1] || "",
        postsCount: cardText.match(/([\d,.Kk]+)\s*投稿/)?.[1] || "",
        singleRewardRate: rates.find((match) => match[1] === "単品販売")?.[2] || "",
        planSignupRewardRate: rates.find((match) => match[1] === "プラン加入")?.[2] || "",
        xUrlSource: isCreatorDetailPage ? "creator_detail_href" : "creator_list_href",
      };
    })
    .filter((creator, index, all) => creator.displayName && all.findIndex((item) => item.myfansUrl === creator.myfansUrl) === index);
  return {
    pageUrl: location.href,
    productTitle: isCreatorSearchPage ? "" : (isCreatorDetailPage || isGeneratedCreatorPage) && firstProductTitle ? firstProductTitle : title,
    productUrl: location.href.includes("/posts/") ? location.href : productLinks[0] || "",
    creatorUrl: links.find((href) => /myfans\.jp\/(?!posts\/)/.test(href)) || "",
    creatorXUrl: xProfileLinks[0] || "",
    sourceXHandle: sourceXHandle ? `@${sourceXHandle}` : "",
    quoteCandidateXUrl: xStatusLinks[0] || "",
    affiliateUrl: validAffiliateUrl(links.find((href) => /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+/.test(href))) || affiliateUrlFromText || Array.from(copiedAffiliateUrlsByProductUrl.values()).find(Boolean) || "",
    creatorName: document.querySelector("[data-creator-name]")?.textContent || "",
    price: firstProductPrice || findNumber([/[¥￥]\s*([\d,]+)/, /価格\s*([\d,]+)/]),
    rewardRate: firstProductReward.includes("売上の全額") ? "100" : firstProductReward || findNumber([/単品購入[:：]\s*([\d.]+)/, /報酬率\s*([\d.]+)/, /単品報酬率\s*([\d.]+)/]),
    planSignupReward: findNumber([/プラン加入報酬\s*[¥￥]?\s*([\d,]+)/]),
    recurringRewardRate: findNumber([/継続報酬率\s*([\d.]+)/]),
    likesCount: findNumber([/いいね\s*([\d,]+)/, /Like\s*([\d,]+)/i]),
    publishedAt: findNumber([/公開日\s*([0-9/.-]+)/, /投稿日\s*([0-9/.-]+)/]),
    creators,
    products: isCreatorDetailPage || isGeneratedCreatorPage ? products : []
  };
}

const EXTENSION_VERSION = chrome.runtime.getManifest().version;
document.getElementById("version").textContent = `version ${EXTENSION_VERSION}`;
document.getElementById("diagExtensionVersion").textContent = EXTENSION_VERSION;

function isDailyPageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.startsWith("/admin/myfans");
  } catch {
    return false;
  }
}

function yesNo(value) {
  return value ? "YES" : "NO";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("現在のタブを取得できませんでした。");
  return tab;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;
      resolve(lastError ? { ok: false, error: lastError.message } : response);
    });
  });
}

async function pingDailyPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => new Promise((resolve) => {
      const requestId = `popup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = window.setTimeout(() => {
        window.removeEventListener("amateur-lab:myfans-quote-refresh:pong", onPong);
        resolve({ ok: false, error: "pong timeout" });
      }, 2500);
      const onPong = (event) => {
        const detail = event instanceof CustomEvent ? event.detail : null;
        if (detail?.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener("amateur-lab:myfans-quote-refresh:pong", onPong);
        resolve({ ok: Boolean(detail?.connected && detail?.worker?.ok), detail });
      };
      window.addEventListener("amateur-lab:myfans-quote-refresh:pong", onPong);
      window.dispatchEvent(new CustomEvent("amateur-lab:myfans-quote-refresh:ping", { detail: { requestId } }));
    })
  });
  return result;
}

async function refreshDiagnostics() {
  const tab = await activeTab();
  const detected = isDailyPageUrl(tab.url);
  document.getElementById("diagTabUrl").textContent = tab.url || "-";
  document.getElementById("diagDetected").textContent = yesNo(detected);
  const background = await sendRuntimeMessage({ type: "myfans_quote_refresh_state" });
  document.getElementById("diagBackground").textContent = background?.ok ? "OK" : "NG";
  document.getElementById("diagWorkerVersion").textContent = background?.workerVersion || "-";
  if (!detected) {
    document.getElementById("diagProbe").textContent = "NO";
    document.getElementById("diagProbeMarker").textContent = "NO";
    document.getElementById("diagInjected").textContent = "NO";
    document.getElementById("diagConnection").textContent = "NO";
    document.getElementById("diagLastAck").textContent = "-";
    return;
  }
  const probe = await sendRuntimeMessage({ type: "myfans_admin_probe", tabId: tab.id });
  document.getElementById("diagProbe").textContent = probe?.canExecuteScript ? "OK" : "NG";
  document.getElementById("diagProbeMarker").textContent = probe?.markerWritten ? "OK" : "NG";
  const diagnostic = await sendRuntimeMessage({ type: "myfans_admin_bridge_diagnostics", tabId: tab.id });
  document.getElementById("diagInjected").textContent = yesNo(diagnostic?.bridgeInjected);
  const ping = diagnostic?.bridgeInjected ? await pingDailyPage(tab.id).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) })) : null;
  document.getElementById("diagConnection").textContent = yesNo(ping?.ok);
  document.getElementById("diagLastAck").textContent = ping?.detail?.lastAck || diagnostic?.lastAck || diagnostic?.markerAt || "-";
  document.getElementById("diagWorkerVersion").textContent = ping?.detail?.worker?.version || diagnostic?.workerVersion || background?.workerVersion || "-";
}

async function connectBridge() {
  const status = document.getElementById("status");
  try {
    status.textContent = "bridgeを接続しています...";
    const tab = await activeTab();
    if (!isDailyPageUrl(tab.url)) throw new Error("Daily Page（/admin/myfans）を開いてから実行してください。");
    const injected = await sendRuntimeMessage({ type: "myfans_admin_bridge_inject", tabId: tab.id, reason: "popup" });
    if (!injected?.ok) throw new Error(injected?.error || "bridgeを注入できませんでした。");
    const ping = await pingDailyPage(tab.id);
    if (!ping?.ok) throw new Error(ping?.error || "PING/PONGを確認できませんでした。");
    status.textContent = "bridge接続を確認しました。";
    await refreshDiagnostics();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "bridge接続に失敗しました";
    await refreshDiagnostics().catch(() => {});
  }
}

function collectXQuoteCandidates() {
  const parseCount = (label) => {
    if (!label) return null;
    const match = String(label).replace(/,/g, "").match(/([\d.]+)\s*([KMB万億]?)/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    const suffix = match[2];
    const multiplier = suffix === "K" ? 1000 : suffix === "M" ? 1000000 : suffix === "B" ? 1000000000 : suffix === "万" ? 10000 : suffix === "億" ? 100000000 : 1;
    return Math.round(value * multiplier);
  };
  const mediaInfoFor = (article, statusUrl) => {
    const anchors = Array.from(article.querySelectorAll("a[href]")).map((link) => link.getAttribute("href") || "");
    const mediaHrefs = anchors
      .map((href) => href.match(/^([^?#]+)(?:[?#].*)?$/)?.[1] || "")
      .filter((href) => new RegExp(`^/${sourceXHandle}/status/\\d+/(photo|video)/[1-9]\\d*$`).test(href));
    const unique = Array.from(new Set(mediaHrefs));
    const videoHref = unique.find((href) => /\/video\/[1-9]\d*$/.test(href)) || "";
    const photoHref = unique.find((href) => /\/photo\/[1-9]\d*$/.test(href)) || "";
    const hasVideo = Boolean(article.querySelector('[data-testid="videoPlayer"], video')) || Boolean(videoHref);
    const hasImage = Boolean(article.querySelector('[data-testid="tweetPhoto"] img')) || Boolean(photoHref);
    const chosen = videoHref || photoHref;
    const mediaType = videoHref ? "video" : photoHref ? "image" : hasVideo ? "video" : hasImage ? "image" : "none";
    const mediaCount = unique.length || (hasVideo || hasImage ? 1 : 0);
    const mediaPermalink = chosen ? `https://x.com${chosen}` : "";
    const generatedVideoPermalink = hasVideo && statusUrl ? `${statusUrl}/video/1` : "";
    return {
      mediaPermalink,
      verifiedVideoPermalink: videoHref ? mediaPermalink : "",
      generatedVideoPermalink,
      validationStatus: mediaPermalink ? "dom_media_permalink" : hasVideo ? "needs_video_permalink_validation" : "not_media",
      mediaType,
      mediaCount,
      hasImage,
      hasVideo,
      quoteVisualReady: Boolean(statusUrl && mediaPermalink)
    };
  };
  const profileMatch = location.href.replace(/^https:\/\/twitter\.com\//, "https://x.com/").match(/^https:\/\/x\.com\/([^/?#]+)/);
  const sourceXHandle = profileMatch?.[1] || "";
  const productId = new URL(location.href).searchParams.get("myfans_product_id") || "";
  const creatorId = new URL(location.href).searchParams.get("myfans_creator_id") || "";
  const refreshJobId = new URL(location.href).searchParams.get("myfans_refresh_job_id") || "";
  const refreshJobItemId = new URL(location.href).searchParams.get("myfans_refresh_item_id") || "";
  if (!sourceXHandle || (!productId && !creatorId)) throw new Error("Daily Pageの「Xプロフィールを開く」から開いてください。");
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, 20);
  const quoteCandidates = articles.map((article) => {
    const statusHref = Array.from(article.querySelectorAll("a[href]"))
      .map((link) => link.getAttribute("href") || "")
      .find((href) => new RegExp(`^/${sourceXHandle}/status/\\d+`).test(href));
    const statusUrl = statusHref ? `https://x.com${statusHref.match(/^([^?#]+)/)?.[1] || statusHref}` : "";
    const socialContext = article.querySelector('[data-testid="socialContext"]')?.textContent || "";
    const rawText = article.innerText || "";
    const analytics = Array.from(article.querySelectorAll("a[href]"))
      .find((link) => /\/analytics$/.test(link.getAttribute("href") || ""));
    const metric = (testId) => parseCount(article.querySelector(`[data-testid="${testId}"]`)?.getAttribute("aria-label") || "");
    const media = mediaInfoFor(article, statusUrl);
    return {
      xPostUrl: statusUrl,
      mediaPermalink: media.mediaPermalink,
      verifiedVideoPermalink: media.verifiedVideoPermalink,
      generatedVideoPermalink: media.generatedVideoPermalink,
      validationStatus: media.validationStatus,
      mediaType: media.mediaType,
      mediaCount: media.mediaCount,
      quoteVisualReady: media.quoteVisualReady,
      sourceXHandle,
      postedAt: article.querySelector("time")?.getAttribute("datetime") || null,
      text: article.querySelector('[data-testid="tweetText"]')?.textContent || "",
      views: parseCount(analytics?.getAttribute("aria-label") || analytics?.textContent || ""),
      likes: metric("like"),
      reposts: metric("retweet"),
      replies: metric("reply"),
      bookmarks: metric("bookmark"),
      hasImage: media.hasImage,
      hasVideo: media.hasVideo,
      isPinned: /固定|Pinned/i.test(socialContext || rawText.split("\n").slice(0, 3).join(" ")),
      isReply: /返信先:|Replying to/i.test(rawText),
      isRepost: /リポストしました|reposted/i.test(socialContext),
      isQuote: Boolean(article.querySelector('div[role="link"] article')),
    };
  }).filter((candidate, index, all) =>
    candidate.xPostUrl &&
    all.findIndex((item) => item.xPostUrl === candidate.xPostUrl) === index
  );
  if (quoteCandidates.length === 0) throw new Error("表示中範囲からcreator本人投稿を取得できませんでした。");
  return {
    type: "x_quote_scan",
    pageUrl: location.href,
    productId,
    creatorId,
    creatorXUrl: `https://x.com/${sourceXHandle}`,
    sourceXHandle,
    refreshJobId,
    refreshJobItemId,
    quoteCandidates,
  };
}

function baseUrl() {
  return document.getElementById("baseUrl").value.replace(/\/$/, "");
}

function approvedMediaFields() {
  return {
    approvedMediaName: document.getElementById("mediaName").value,
    approvedMediaId: document.getElementById("mediaId").value
  };
}

async function quoteRefreshRequest(body) {
  const response = await fetch(`${baseUrl()}/api/admin/myfans/quote-refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ...approvedMediaFields() })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `更新キュー操作に失敗しました (${response.status})`);
  return payload;
}

async function getActiveQuoteJob() {
  const query = new URLSearchParams();
  const approvedMediaId = document.getElementById("mediaId").value;
  if (approvedMediaId) query.set("approvedMediaId", approvedMediaId);
  const response = await fetch(`${baseUrl()}/api/admin/myfans/quote-refresh?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `進捗取得に失敗しました (${response.status})`);
  return payload.job;
}

async function runBulkQuoteRefresh() {
  const tab = await activeTab();
  if (!isDailyPageUrl(tab.url)) throw new Error("Daily Page（/admin/myfans）を開いてから実行してください。");
  const probe = await sendRuntimeMessage({ type: "myfans_admin_probe", tabId: tab.id });
  if (!probe?.ok) throw new Error(probe?.error || "Daily PageへのexecuteScript probeに失敗しました。");
  const batchSize = Math.min(50, Math.max(1, Math.round(Number(document.getElementById("batchSize").value) || 5)));
  await chrome.runtime.sendMessage({
    type: "myfans_quote_refresh_start",
    settings: {
      baseUrl: baseUrl(),
      approvedMediaName: document.getElementById("mediaName").value,
      approvedMediaId: document.getElementById("mediaId").value,
      batchSize,
      queueLimit: batchSize
    }
  });
  document.getElementById("batchStatus").textContent = `probe OK。backgroundで${batchSize} creatorの一括更新を開始しました。`;
}

async function legacySendPayload(result) {
  const baseUrl = document.getElementById("baseUrl").value.replace(/\/$/, "");
  const approvedMediaName = document.getElementById("mediaName").value;
  const approvedMediaId = document.getElementById("mediaId").value;
  const response = await fetch(`${baseUrl}/api/admin/myfans/companion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...result, approvedMediaName, approvedMediaId })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `送信に失敗しました (${response.status})`);
  return payload;
}

document.getElementById("send").addEventListener("click", async () => {
  const status = document.getElementById("status");
  try {
    status.textContent = "送信中...";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: collectFromPage
    });
    const payload = await legacySendPayload(result);
    status.textContent = payload.importedType === "creators"
      ? `クリエイター${payload.creatorsCount}件を登録しました。Xリンク${payload.xUrlCount || 0}件。`
      : payload.importedType === "products"
        ? `商品${payload.productsCount}件を登録しました。`
        : `登録しました。Score ${payload.selectionScore}`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "送信に失敗しました";
  }
});

document.getElementById("quoteScan").addEventListener("click", async () => {
  const status = document.getElementById("status");
  try {
    status.textContent = "引用候補を収集中...";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/^https:\/\/(?:x|twitter)\.com\/[^/?#]+/.test(tab.url || "")) throw new Error("Xプロフィールページで実行してください。");
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: collectXQuoteCandidates
    });
    const payload = await legacySendPayload(result);
    status.textContent = payload.selected
      ? `候補${payload.candidatesCount}件から自動選定しました。Score ${payload.selected.score}`
      : `候補${payload.candidatesCount}件を保存しましたが、品質閾値未満です。`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "引用候補を収集できませんでした";
  }
});

document.getElementById("bulkQuoteScan").addEventListener("click", async () => {
  const status = document.getElementById("status");
  try {
    status.textContent = "一括更新を開始します...";
    await runBulkQuoteRefresh();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "一括更新を実行できませんでした";
  }
});

chrome.runtime.sendMessage({ type: "myfans_quote_refresh_state" }, (response) => {
  const state = response?.state;
  if (!state) return;
  document.getElementById("batchStatus").textContent = [
    state.message || "",
    state.currentCreator ? `現在: ${state.currentCreator}` : "",
    state.stage ? `stage: ${state.stage}` : "",
    state.articleCount != null ? `article: ${state.articleCount}` : "",
    state.ownPostCount != null ? `own post: ${state.ownPostCount}` : "",
    state.candidateCount != null ? `candidate: ${state.candidateCount}` : "",
    state.videoCandidates != null ? `video: ${state.videoCandidates}` : "",
    state.videoValidation ? `video validation: ${state.videoValidation.verified || 0}/${state.videoValidation.checked || 0} ok, fail ${state.videoValidation.failed || 0}` : "",
    state.retryCount != null ? `retry: ${state.retryCount}` : "",
    state.finalStatus ? `final: ${state.finalStatus}` : "",
    state.errorCode ? `reason: ${state.errorCode}` : "",
    state.sessionProcessed != null ? `このセッション: ${state.sessionProcessed}件` : "",
    state.lastCandidatesCount != null ? `直近候補: ${state.lastCandidatesCount}件` : "",
    state.lastError ? `error: ${state.lastError}` : ""
  ].filter(Boolean).join("\n");
});

document.getElementById("pauseBulk").addEventListener("click", async () => {
  const job = await getActiveQuoteJob();
  if (!job?.id) {
    document.getElementById("batchStatus").textContent = "一時停止するジョブがありません。";
    return;
  }
  const payload = await quoteRefreshRequest({ action: "pause", jobId: job.id });
  document.getElementById("batchStatus").textContent = payload.job ? "一時停止しました。" : "一時停止するジョブがありません。";
});

document.getElementById("cancelBulk").addEventListener("click", async () => {
  const job = await getActiveQuoteJob();
  if (!job?.id) {
    document.getElementById("batchStatus").textContent = "中止するジョブがありません。";
    return;
  }
  await quoteRefreshRequest({ action: "cancel", jobId: job.id });
  document.getElementById("batchStatus").textContent = "中止しました。";
});

document.getElementById("connectBridge").addEventListener("click", connectBridge);
refreshDiagnostics().catch((error) => {
  document.getElementById("diagBackground").textContent = "NG";
  document.getElementById("status").textContent = error instanceof Error ? error.message : "診断を取得できませんでした";
});
