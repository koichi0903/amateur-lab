export type LocalOriginValidationInput = {
  requestHostname: string;
  host: string | null;
  requestProtocol: string;
  forwardedProtocol: string | null;
  origin: string | null;
  secFetchSite: string | null;
};

export function isLocalhost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function requestProtocolFor(input: LocalOriginValidationInput) {
  const forwardedProtocol = input.forwardedProtocol?.split(",")[0]?.trim();
  return forwardedProtocol ? `${forwardedProtocol}:` : input.requestProtocol;
}

function localRequestHost(protocol: string, host: string) {
  try {
    return new URL(`${protocol}//${host}`);
  } catch {
    return null;
  }
}

function originMatchesRequest(origin: string, requestProtocol: string, requestHost: URL) {
  try {
    const originUrl = new URL(origin);
    return originUrl.protocol === requestProtocol
      && isLocalhost(originUrl.hostname)
      && originUrl.hostname === requestHost.hostname
      && originUrl.host === requestHost.host;
  } catch {
    return false;
  }
}

export function isSameLocalOrigin(input: LocalOriginValidationInput) {
  if (!input.host || !isLocalhost(input.requestHostname)) return false;
  const requestProtocol = requestProtocolFor(input);
  const requestHost = localRequestHost(requestProtocol, input.host);
  if (!requestHost || !isLocalhost(requestHost.hostname)) return false;
  if (!input.origin) return input.secFetchSite === "same-origin";
  return originMatchesRequest(input.origin, requestProtocol, requestHost);
}
