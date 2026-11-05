import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { completeOAuth, getOAuthFailureDiagnostics, isSocialPlatform } from "@/lib/socialPublishingOAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { platform: rawPlatform } = await params;
  if (!isSocialPlatform(rawPlatform)) return NextResponse.json({ error: "Unknown publishing channel." }, { status: 404 });

  const errorCode = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const resultUrl = new URL("/admin/x-growth", request.url);
  const response = (ok: boolean, failureStage?: string) => {
    resultUrl.searchParams.set("social_connection", ok ? "connected" : "failed");
    resultUrl.searchParams.set("channel", rawPlatform);
    if (!ok && failureStage) resultUrl.searchParams.set("failure_stage", failureStage);
    const result = NextResponse.redirect(resultUrl);
    result.cookies.set(`hakkutsu_social_oauth_${rawPlatform}`, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/admin/social-publishing/oauth",
      maxAge: 0,
    });
    return result;
  };

  if (errorCode || !code || !state) {
    // Only log a coarse reason. Never log OAuth codes, state, or provider error descriptions.
    console.warn('[social-publishing] OAuth callback returned without a usable grant', {
      channel: rawPlatform,
      reason: errorCode ? 'provider_denied_or_failed' : !code ? 'authorization_code_missing' : 'state_missing',
    });
    return response(false, errorCode ? "provider_consent" : !code ? "authorization_code" : "oauth_state");
  }
  try {
    await completeOAuth(request, rawPlatform, code, state);
    return response(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OAuth callback error';
    const knownProviderCode = message.match(/\b(invalid_grant|redirect_uri_mismatch|invalid_client|access_denied|invalid_request|unauthorized_client|insufficient_scope|invalid_scope|unsupported_grant_type)\b/i)?.[1] ?? null;
    const diagnostics = getOAuthFailureDiagnostics(error);
    const stage = diagnostics.stage;
    const provider = diagnostics.provider;
    const category = stage ?? (/state|browser session|channel/i.test(message) ? 'oauth_state_or_channel_validation'
      : /expired/i.test(message) ? 'oauth_request_expired'
      : /encryption/i.test(message) ? 'token_encryption_configuration'
      : /scope|permission/i.test(message) ? 'provider_scope_validation'
      : /redirect_uri_mismatch/i.test(message) ? 'redirect_uri_mismatch'
      : /invalid_client/i.test(message) ? 'provider_client_configuration'
      : /access_denied/i.test(message) ? 'provider_access_denied'
      : /could not save|database|authorized channel/i.test(message) ? 'channel_persistence'
      : provider || knownProviderCode ? 'provider_oauth_exchange'
      : 'provider_oauth_or_account_validation');
    console.error('[social-publishing] OAuth callback failed', {
      channel: rawPlatform,
      category,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      rootErrorName: diagnostics.rootErrorName,
      providerOperation: provider?.operation ?? null,
      providerFailureKind: provider?.failureKind ?? null,
      providerHttpStatus: provider?.httpStatus ?? null,
      providerCode: provider?.providerCode ?? knownProviderCode,
      providerType: provider?.providerType ?? null,
      providerSubcode: provider?.providerSubcode ?? null,
      transportErrorName: provider?.transportErrorName ?? null,
    });
    return response(false, stage ?? "unknown");
  }
}
