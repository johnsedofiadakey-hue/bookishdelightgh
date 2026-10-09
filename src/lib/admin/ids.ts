import { createHash, randomBytes, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Deterministic document ID derived from parts, safe for Firestore IDs. */
export function derivedId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${sha256Hex(parts.join("\u0000")).slice(0, 32)}`;
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Customer-facing order reference: BD- plus 6 unambiguous characters. */
export function newOrderRef(): string {
  const bytes = randomBytes(6);
  return `BD-${Array.from(bytes, (byte) => REF_ALPHABET[byte % REF_ALPHABET.length]).join("")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Idempotency keys are client-generated UUIDs embedded in each form render. */
export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(key);
}
