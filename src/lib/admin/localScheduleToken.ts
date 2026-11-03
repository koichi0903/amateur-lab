import { timingSafeEqual } from "node:crypto";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function isValidLocalScheduleToken(
  hostname: string,
  expected: string | undefined,
  supplied: string | null,
) {
  if (!LOOPBACK_HOSTS.has(hostname) || !expected || !supplied) return false;

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
