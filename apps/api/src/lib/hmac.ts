import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies `sha256=<hex>` (or bare hex) over the RAW request body with a shared secret.
 * Timing-safe, and false when the secret is unset so a misconfigured deploy fails closed.
 */
export function verifySignature(
  secret: string | undefined,
  rawBody: string,
  header: string | null | undefined,
): boolean {
  if (!secret || !header) return false;
  const provided = header.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(provided, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function signBody(secret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}
