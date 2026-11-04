export function isSocialTokenEncryptionConfigured() {
  const encoded = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
  try {
    const key = Buffer.from(encoded, "base64");
    return key.length === 32 && key.toString("base64") === encoded;
  } catch {
    return false;
  }
}

export function isTikTokAutoPublishingConfigured() {
  // TikTok's current Content Sharing Guidelines reject a private utility that
  // only uploads to accounts managed by the developer or its team. This
  // product is internal-only; no environment flag can make Direct Post eligible.
  // Reconsider only after a genuine broad-audience creator product and its
  // required preview, consent, and commercial-disclosure UX exist.
  return false;
}
