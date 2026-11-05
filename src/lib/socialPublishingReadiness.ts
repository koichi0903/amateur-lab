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
