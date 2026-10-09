import { createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto";
import { isProductionRuntime } from "@/lib/admin/env";
import { AdminError } from "@/lib/admin/errors";

/**
 * Firebase ID token verification without the Admin SDK, following
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 *
 * Signature (RS256 against Google's securetoken certificates), audience,
 * issuer, expiry, issued-at, auth_time and subject are all checked.
 * Revocation/disabled-user checks need the Admin SDK and live behind
 * `IdentityAdmin` (see identity.ts).
 */

const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CLOCK_SKEW_SECONDS = 60;

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  authTime: number;
  issuedAt: number;
  expiresAt: number;
  claims: Record<string, unknown>;
}

let certCache: { keys: Map<string, KeyObject>; expiresAt: number } | undefined;

async function loadCerts(): Promise<Map<string, KeyObject>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.keys;
  const response = await fetch(CERT_URL, { cache: "no-store" });
  if (!response.ok) throw new AdminError("unavailable", "Could not reach Firebase to verify sign-in. Try again shortly.");
  const body = (await response.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  const keys = new Map(Object.entries(body).map(([kid, pem]) => [kid, createPublicKey(pem)]));
  certCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new AdminError("unauthenticated", "Malformed sign-in token.");
  }
}

function emulatorActive(): boolean {
  return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) && !isProductionRuntime();
}

export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<VerifiedFirebaseToken> {
  if (!projectId) throw new AdminError("unavailable", "Firebase project is not configured.");
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new AdminError("unauthenticated", "Malformed sign-in token.");
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = decodeSegment(headerSegment);
  const payload = decodeSegment(payloadSegment);

  if (emulatorActive() && header.alg === "none") {
    // The Auth emulator issues unsigned tokens. Accepted only in development
    // with FIREBASE_AUTH_EMULATOR_HOST set; claims are still validated below.
  } else {
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw new AdminError("unauthenticated", "Unexpected sign-in token algorithm.");
    const key = (await loadCerts()).get(header.kid);
    if (!key) throw new AdminError("unauthenticated", "Sign-in token key is unknown or rotated. Sign in again.");
    const valid = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${headerSegment}.${payloadSegment}`),
      key,
      Buffer.from(signatureSegment, "base64url"),
    );
    if (!valid) throw new AdminError("unauthenticated", "Sign-in token signature is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  const iat = Number(payload.iat);
  const authTime = Number(payload.auth_time);
  if (payload.aud !== projectId) throw new AdminError("unauthenticated", "Sign-in token is for a different project.");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new AdminError("unauthenticated", "Sign-in token issuer is invalid.");
  if (!Number.isFinite(exp) || exp + CLOCK_SKEW_SECONDS < now) throw new AdminError("unauthenticated", "Sign-in token has expired.");
  if (!Number.isFinite(iat) || iat - CLOCK_SKEW_SECONDS > now) throw new AdminError("unauthenticated", "Sign-in token is not yet valid.");
  if (!Number.isFinite(authTime) || authTime - CLOCK_SKEW_SECONDS > now) throw new AdminError("unauthenticated", "Sign-in time is invalid.");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw new AdminError("unauthenticated", "Sign-in token subject is invalid.");

  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    authTime,
    issuedAt: iat,
    expiresAt: exp,
    claims: payload,
  };
}
