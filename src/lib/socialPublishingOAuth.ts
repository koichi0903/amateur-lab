import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const SOCIAL_PLATFORMS = ["youtube_shorts", "instagram_reels", "threads", "tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  scopes: string[];
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  scope?: string;
  permissions?: unknown;
  user_id?: string | number;
  open_id?: string;
};

const COOKIE_PREFIX = "hakkutsu_social_oauth_";
const STATE_TTL_MS = 10 * 60 * 1000;

function config(platform: SocialPlatform): OAuthConfig | null {
  const env = process.env;
  const secret = env.CRON_SECRET;
  if (!secret) return null;
  if (platform === "youtube_shorts") {
    const clientId = env.YOUTUBE_CLIENT_ID;
    const clientSecret = env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = env.YOUTUBE_REDIRECT_URI;
    return clientId && clientSecret && redirectUri ? {
      clientId, clientSecret, redirectUri,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    } : null;
  }
  if (platform === "instagram_reels") {
    const clientId = env.INSTAGRAM_APP_ID;
    const clientSecret = env.INSTAGRAM_APP_SECRET;
    const redirectUri = env.INSTAGRAM_REDIRECT_URI;
    return clientId && clientSecret && redirectUri ? {
      clientId, clientSecret, redirectUri,
      authorizeUrl: "https://www.instagram.com/oauth/authorize",
      scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    } : null;
  }
  if (platform === "threads") {
    const clientId = env.THREADS_APP_ID;
    const clientSecret = env.THREADS_APP_SECRET;
    const redirectUri = env.THREADS_REDIRECT_URI;
    return clientId && clientSecret && redirectUri ? {
      clientId, clientSecret, redirectUri,
      authorizeUrl: "https://threads.net/oauth/authorize",
      scopes: ["threads_basic", "threads_content_publish"],
    } : null;
  }
  if (platform === "tiktok") {
    const clientId = env.TIKTOK_CLIENT_KEY;
    const clientSecret = env.TIKTOK_CLIENT_SECRET;
    const redirectUri = env.TIKTOK_REDIRECT_URI;
    if (env.TIKTOK_CONTENT_POSTING_API_APPROVED !== "true" || env.TIKTOK_DIRECT_POST_AUDITED !== "true") return null;
    return clientId && clientSecret && redirectUri ? {
      clientId, clientSecret, redirectUri,
      authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
      scopes: ["user.info.basic", "video.publish"],
    } : null;
  }
  return null;
}

function b64url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function signingKey() {
  const key = process.env.CRON_SECRET;
  if (!key) throw new Error("OAuth state signing is not configured.");
  return key;
}

function signedState(payload: string) {
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function validSignedState(value: string) {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac("sha256", signingKey()).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.includes(value as SocialPlatform);
}

export function getMissingSocialPublishingScopes(platform: SocialPlatform, grantedScopes: string[]) {
  const settings = config(platform);
  const requiredScopes = settings?.scopes ?? [];
  if (requiredScopes.length === 0) return ["provider_publish_scope_not_configured"];
  const granted = new Set(grantedScopes);
  return requiredScopes.filter((scope) => !granted.has(scope));
}

export function getOAuthConfig(platform: SocialPlatform) {
  return config(platform);
}

export function createOAuthRedirect(request: NextRequest, platform: SocialPlatform) {
  const settings = config(platform);
  if (!settings) throw new Error("OAuth app settings are incomplete for this channel.");
  const nonce = randomBytes(24).toString("base64url");
  const issuedAt = Date.now();
  const statePayload = b64url(JSON.stringify({ platform, nonce, issuedAt }));
  const state = signedState(statePayload);
  const url = new URL(settings.authorizeUrl);
  if (platform === "tiktok") {
    url.searchParams.set("client_key", settings.clientId);
    url.searchParams.set("redirect_uri", settings.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", settings.scopes.join(","));
    url.searchParams.set("state", state);
    return { url, cookieValue: `${state}|${nonce}|${issuedAt}`, cookieName: `${COOKIE_PREFIX}${platform}` };
  }
  url.searchParams.set("client_id", settings.clientId);
  url.searchParams.set("redirect_uri", settings.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", platform === "youtube_shorts" ? settings.scopes.join(" ") : settings.scopes.join(","));
  url.searchParams.set("state", state);
  if (platform === "youtube_shorts") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
  }
  return {
    url,
    cookieValue: `${state}|${nonce}|${issuedAt}`,
    cookieName: `${COOKIE_PREFIX}${platform}`,
  };
}

function postForm(url: string, form: URLSearchParams, headers?: HeadersInit) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body: form });
}

async function getJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: { message?: string; code?: string }; error_description?: string }) | null;
  if (!response.ok || !payload) throw new Error(payload?.error_description || payload?.error?.message || "OAuth provider request failed.");
  return payload;
}

async function exchangeCode(platform: SocialPlatform, settings: OAuthConfig, code: string) {
  if (platform === "tiktok") {
    const form = new URLSearchParams({ client_key: settings.clientId, client_secret: settings.clientSecret, code, grant_type: "authorization_code", redirect_uri: settings.redirectUri });
    const body = await getJson<{ access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; scope?: string; open_id?: string }>(await postForm("https://open.tiktokapis.com/v2/oauth/token/", form, { "Cache-Control": "no-cache" }));
    if (!body.access_token || !body.open_id || !body.refresh_token || !body.scope) throw new Error("TikTok did not return a verifiable authorized account and scope list.");
    return body as TokenResponse;
  }
  const form = new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret, code, redirect_uri: settings.redirectUri });
  let response: Response;
  if (platform === "youtube_shorts") {
    form.set("grant_type", "authorization_code");
    response = await postForm("https://oauth2.googleapis.com/token", form);
  } else if (platform === "instagram_reels") {
    form.set("grant_type", "authorization_code");
    response = await postForm("https://api.instagram.com/oauth/access_token", form);
  } else if (platform === "threads") {
    form.set("grant_type", "authorization_code");
    const url = new URL("https://graph.threads.net/oauth/access_token");
    form.forEach((value, key) => url.searchParams.set(key, value));
    response = await fetch(url, { method: "POST" });
  } else {
    throw new Error("Unsupported social publishing OAuth platform.");
  }
  const body = await getJson<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; permissions?: unknown; user_id?: string | number; open_id?: string; data?: TokenResponse | TokenResponse[]; error?: { message?: string } }>(response);
  const providerToken = body.data ?? body;
  if (Array.isArray(providerToken) && providerToken.length !== 1) {
    throw new Error("OAuth provider returned an unexpected number of authorized accounts.");
  }
  const token = (Array.isArray(providerToken) ? providerToken[0] : providerToken) as TokenResponse;
  if (!token.access_token) throw new Error("OAuth provider did not return an access token.");

  if (platform === "instagram_reels" && !token.scope) {
    const permissions = token.permissions;
    if (typeof permissions === "string") {
      token.scope = permissions;
    } else if (Array.isArray(permissions) && permissions.every((permission) => typeof permission === "string")) {
      token.scope = permissions.join(" ");
    } else if (Array.isArray(permissions)) {
      const granted = permissions.flatMap((permission) => {
        if (!permission || typeof permission !== "object") return [];
        const item = permission as { permission?: unknown; status?: unknown };
        return typeof item.permission === "string" && item.status === "granted" ? [item.permission] : [];
      });
      token.scope = granted.join(" ");
    }
  }

  if ((platform === "instagram_reels" || platform === "threads") && token.access_token) {
    const exchangeUrl = platform === "instagram_reels" ? "https://graph.instagram.com/access_token" : "https://graph.threads.net/access_token";
    const longLivedUrl = new URL(exchangeUrl);
    longLivedUrl.searchParams.set("grant_type", platform === "instagram_reels" ? "ig_exchange_token" : "th_exchange_token");
    longLivedUrl.searchParams.set("client_secret", settings.clientSecret);
    longLivedUrl.searchParams.set("access_token", token.access_token);
    const longLived = await getJson<TokenResponse>(await fetch(longLivedUrl));
    return { ...token, ...longLived, user_id: token.user_id ?? longLived.user_id, scope: token.scope ?? longLived.scope };
  }
  return token;
}

async function inspectThreadsGrantedScopes(settings: OAuthConfig, userAccessToken: string) {
  const appTokenUrl = new URL("https://graph.threads.net/oauth/access_token");
  appTokenUrl.searchParams.set("grant_type", "client_credentials");
  appTokenUrl.searchParams.set("client_id", settings.clientId);
  appTokenUrl.searchParams.set("client_secret", settings.clientSecret);
  const appToken = await getJson<{ access_token?: string }>(await fetch(appTokenUrl, { signal: AbortSignal.timeout(20_000) }));
  if (!appToken.access_token) throw new Error("Threads app access token was not returned.");

  const debugUrl = new URL("https://graph.threads.net/debug_token");
  debugUrl.searchParams.set("input_token", userAccessToken);
  const debug = await getJson<{ data?: { app_id?: string; is_valid?: boolean; scopes?: unknown } }>(await fetch(debugUrl, {
    headers: { Authorization: `Bearer ${appToken.access_token}` },
    signal: AbortSignal.timeout(20_000),
  }));
  const data = debug.data;
  if (!data?.is_valid || (data.app_id && data.app_id !== settings.clientId) || !Array.isArray(data.scopes) || !data.scopes.every((scope) => typeof scope === "string")) {
    throw new Error("Threads did not confirm a valid token and its granted permissions.");
  }
  return data.scopes as string[];
}

async function accountIdentity(platform: SocialPlatform, token: TokenResponse) {
  const bearer = { Authorization: `Bearer ${token.access_token}` };
  if (platform === "youtube_shorts") {
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "id,snippet");
    url.searchParams.set("mine", "true");
    const data = await getJson<{ items?: Array<{ id: string; snippet?: { title?: string } }> }>(await fetch(url, { headers: bearer }));
    const channel = data.items?.[0];
    if (!channel?.id) throw new Error("No YouTube channel was returned for this account.");
    return { id: channel.id, label: channel.snippet?.title || channel.id };
  }
  if (platform === "instagram_reels") {
    const url = new URL("https://graph.instagram.com/me");
    url.searchParams.set("fields", "user_id,username");
    const data = await getJson<{ user_id?: string | number; id?: string | number; username?: string }>(await fetch(url, { headers: bearer }));
    const id = String(data.user_id ?? data.id ?? token.user_id ?? "");
    if (!id) throw new Error("Instagram did not return an account id.");
    return { id, label: data.username || id };
  }
  if (platform === "threads") {
    const url = new URL("https://graph.threads.net/v1.0/me");
    url.searchParams.set("fields", "id,username");
    const data = await getJson<{ id?: string; username?: string }>(await fetch(url, { headers: bearer }));
    if (!data.id) throw new Error("Threads did not return an account id.");
    return { id: data.id, label: data.username || data.id };
  }
  if (platform === "tiktok") {
    if (!token.open_id) throw new Error("TikTok did not return the authorized account id.");
    const url = new URL("https://open.tiktokapis.com/v2/user/info/");
    url.searchParams.set("fields", "open_id,display_name");
    const data = await getJson<{ data?: { user?: { open_id?: string; display_name?: string } }; error?: { code?: string } }>(await fetch(url, { headers: bearer, signal: AbortSignal.timeout(20_000) }));
    const user = data.data?.user;
    if (data.error?.code !== "ok" || !user?.open_id || user.open_id !== token.open_id) throw new Error("TikTok did not confirm the authorized creator account.");
    return { id: user.open_id, label: user.display_name || user.open_id };
  }
  throw new Error("Unsupported social account provider.");
}

function encryptionKey() {
  const encoded = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Social token encryption key is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Social token encryption key must be a 32-byte base64 value.");
  return key;
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored social token is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function refreshToken(platform: SocialPlatform, settings: OAuthConfig, accessToken: string, refreshTokenValue: string | null) {
  let response: Response;
  if (platform === "tiktok") {
    if (!refreshTokenValue) throw new Error("TikTok refresh token is missing; reconnect this account.");
    const form = new URLSearchParams({ client_key: settings.clientId, client_secret: settings.clientSecret, grant_type: "refresh_token", refresh_token: refreshTokenValue });
    response = await postForm("https://open.tiktokapis.com/v2/oauth/token/", form, { "Cache-Control": "no-cache" });
  } else if (platform === "youtube_shorts") {
    if (!refreshTokenValue) throw new Error("YouTube refresh token is missing; reconnect this account.");
    const form = new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token",
    });
    response = await postForm("https://oauth2.googleapis.com/token", form);
  } else {
    const url = new URL(platform === "instagram_reels"
      ? "https://graph.instagram.com/refresh_access_token"
      : "https://graph.threads.net/refresh_access_token");
    url.searchParams.set("grant_type", platform === "instagram_reels" ? "ig_refresh_token" : "th_refresh_token");
    url.searchParams.set("access_token", accessToken);
    response = await fetch(url);
  }
  const body = await getJson<{ access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; scope?: string; data?: TokenResponse }>(response);
  const token = (body.data ?? body) as TokenResponse;
  if (platform === "tiktok" && (!token.refresh_token || !token.scope)) {
    throw new Error("TikTok did not return the rotated refresh token and granted scopes; reconnect this account before publishing.");
  }
  if (!token.access_token || !token.expires_in) throw new Error("Provider did not return a refreshed token and expiry.");
  return token;
}

export async function getUsableSocialAccessToken(channelId: string) {
  const { data: channel, error } = await supabaseAdmin
    .from("social_publishing_channels")
    .select("id, platform, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, scopes, enabled")
    .eq("id", channelId)
    .maybeSingle();
  if (error) throw new Error("Could not load social publishing credentials.");
  if (!channel?.enabled || !isSocialPlatform(channel.platform)) throw new Error("Social publishing channel is not enabled.");
  const settings = config(channel.platform);
  const grantedScopes = Array.isArray(channel.scopes) ? channel.scopes : [];
  const missingScopes = getMissingSocialPublishingScopes(channel.platform, grantedScopes);
  if (missingScopes.length > 0) {
    await supabaseAdmin.from("social_publishing_channels").update({
      enabled: false,
      last_error_code: "publish_scope_missing",
      last_error_at: new Date().toISOString(),
    }).eq("id", channelId).eq("enabled", true);
    throw new Error("Publishing stopped because the channel's confirmed permissions are missing.");
  }
  if (!channel.token_expires_at) throw new Error("Social access-token expiry is unknown; reconnect this account.");

  const expiresAt = new Date(channel.token_expires_at).getTime();
  const currentToken = decryptToken(channel.access_token_ciphertext);
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 5 * 60_000) return currentToken;
  if (!settings) throw new Error("Social OAuth app settings are incomplete.");

  try {
    const refreshed = await refreshToken(
      channel.platform,
      settings,
      currentToken,
      channel.refresh_token_ciphertext ? decryptToken(channel.refresh_token_ciphertext) : null,
    );
    if (channel.platform === "tiktok") {
      const scopes = refreshed.scope?.split(/[ ,]+/).filter(Boolean) ?? [];
      if (scopes.length === 0) throw new Error("TikTok did not return refreshed OAuth scopes; reconnect this account before publishing.");
      if (getMissingSocialPublishingScopes(channel.platform, scopes).length > 0) {
        await supabaseAdmin.from("social_publishing_channels").update({
          enabled: false,
          last_error_code: "publish_scope_missing",
          last_error_at: new Date().toISOString(),
        }).eq("id", channelId).eq("enabled", true);
        throw new Error("Publishing stopped because TikTok's refreshed token no longer has the required permissions.");
      }
    }
    const now = Date.now();
    const update = {
      access_token_ciphertext: encryptToken(refreshed.access_token),
      refresh_token_ciphertext: refreshed.refresh_token ? encryptToken(refreshed.refresh_token) : channel.refresh_token_ciphertext,
      token_expires_at: new Date(now + refreshed.expires_in! * 1000).toISOString(),
      refresh_token_expires_at: refreshed.refresh_expires_in ? new Date(now + refreshed.refresh_expires_in * 1000).toISOString() : undefined,
      scopes: refreshed.scope?.split(/[ ,]+/).filter(Boolean) ?? channel.scopes,
      last_error_code: null,
      last_error_at: null,
      updated_at: new Date(now).toISOString(),
    };
    const { data, error: updateError } = await supabaseAdmin
      .from("social_publishing_channels")
      .update(update)
      .eq("id", channelId)
      .eq("token_expires_at", channel.token_expires_at)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error("Could not persist the refreshed social token.");
    if (!data) {
      const { data: latest, error: latestError } = await supabaseAdmin
        .from("social_publishing_channels")
        .select("access_token_ciphertext, token_expires_at, enabled")
        .eq("id", channelId)
        .maybeSingle();
      if (latestError || !latest?.enabled || !latest.token_expires_at || new Date(latest.token_expires_at).getTime() <= Date.now() + 60_000) {
        throw new Error("Social token refresh raced with another worker; retry this job.");
      }
      return decryptToken(latest.access_token_ciphertext);
    }
    return refreshed.access_token;
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("refreshed token no longer has the required permissions")) {
      throw cause;
    }
    const { data: latest } = await supabaseAdmin
      .from("social_publishing_channels")
      .select("access_token_ciphertext, token_expires_at, enabled")
      .eq("id", channelId)
      .maybeSingle();
    if (latest?.enabled && latest.token_expires_at && new Date(latest.token_expires_at).getTime() > Date.now() + 60_000) {
      return decryptToken(latest.access_token_ciphertext);
    }
    await supabaseAdmin.from("social_publishing_channels").update({
      last_error_code: "token_refresh_failed",
      last_error_at: new Date().toISOString(),
    }).eq("id", channelId);
    throw cause;
  }
}

export async function completeOAuth(request: NextRequest, platform: SocialPlatform, code: string, returnedState: string) {
  const settings = config(platform);
  if (!settings) throw new Error("OAuth app settings are incomplete for this channel.");
  const cookieName = `${COOKIE_PREFIX}${platform}`;
  const cookieParts = request.cookies.get(cookieName)?.value.split("|") ?? [];
  const [cookieState, nonce, issuedAtText] = cookieParts;
  const issuedAt = Number(issuedAtText);
  if (!cookieState || cookieState !== returnedState || !validSignedState(returnedState)) throw new Error("OAuth state did not match this browser session.");
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > STATE_TTL_MS || Date.now() < issuedAt - 60_000) throw new Error("OAuth request expired. Start the connection again.");
  let payload: { platform?: string; nonce?: string; issuedAt?: number };
  try { payload = JSON.parse(Buffer.from(returnedState.slice(0, returnedState.lastIndexOf(".")), "base64url").toString("utf8")); } catch { throw new Error("Invalid OAuth state."); }
  if (payload.platform !== platform || payload.nonce !== nonce || payload.issuedAt !== issuedAt) throw new Error("OAuth state did not match this channel.");

  const token = await exchangeCode(platform, settings, code);
  if (platform === "threads") {
    const scopes = await inspectThreadsGrantedScopes(settings, token.access_token);
    token.scope = scopes.join(" ");
  }
  const account = await accountIdentity(platform, token);
  const { error } = await supabaseAdmin.from("social_publishing_channels").upsert({
    platform,
    provider_account_id: account.id,
    account_label: account.label,
    access_token_ciphertext: encryptToken(token.access_token),
    refresh_token_ciphertext: token.refresh_token ? encryptToken(token.refresh_token) : null,
    token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    refresh_token_expires_at: token.refresh_expires_in ? new Date(Date.now() + token.refresh_expires_in * 1000).toISOString() : null,
    // Never record the requested scope as if the provider had granted it.
    scopes: token.scope?.split(/[ ,]+/).filter(Boolean) ?? [],
    enabled: false,
    last_error_code: null,
    last_error_at: null,
    authorized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "platform,provider_account_id" });
  if (error) throw new Error("Could not save the authorized channel.");
  return { accountLabel: account.label, cookieName };
}
