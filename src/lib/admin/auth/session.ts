import { timingSafeEqual } from "node:crypto";
import { recordAudit } from "@/lib/admin/audit";
import { verifyFirebaseIdToken } from "@/lib/admin/auth/firebase-token";
import { getDevelopmentIdentity, getIdentityAdmin, STAFF_CLAIM } from "@/lib/admin/auth/identity";
import type { StaffContext } from "@/lib/admin/context";
import { devSignInEnabled, firebaseWebConfig, MAX_AUTH_AGE_SECONDS, SESSION_TTL_HOURS } from "@/lib/admin/env";
import { AdminError } from "@/lib/admin/errors";
import { newId, nowIso, randomSecret, sha256Hex } from "@/lib/admin/ids";
import type { AdminDataStore } from "@/lib/admin/store/types";
import type { AdminProfile, AdminSession } from "@/lib/admin/types";

/**
 * Server-side staff sessions.
 *
 * Sign-in exchanges a fresh Firebase ID token for an opaque, httpOnly session
 * cookie (`{sessionId}.{secret}`). Only the secret's SHA-256 is stored. Every
 * protected request re-loads the session and the `adminProfiles/{uid}` record,
 * so suspending a profile, changing a role or "sign out everywhere" takes
 * effect on the very next request.
 */

export interface IssuedSession {
  cookieValue: string;
  expiresAt: string;
  profile: AdminProfile;
}

function systemContext(profile: AdminProfile, sessionId: string): StaffContext {
  return { uid: profile.uid, name: profile.displayName, email: profile.email, role: profile.role, sessionId, requestId: newId("req") };
}

async function issueSession(store: AdminDataStore, profile: AdminProfile, userAgent: string | undefined, method: string): Promise<IssuedSession> {
  const sessionId = newId("ses");
  const secret = randomSecret();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();
  const session: AdminSession = { id: sessionId, secretHash: sha256Hex(secret), uid: profile.uid, createdAt, expiresAt, userAgent: userAgent?.slice(0, 200) };
  await store.runTransaction(async (tx) => {
    const fresh = await tx.get("adminProfiles", profile.uid);
    if (!fresh || fresh.status !== "active") throw new AdminError("forbidden", "This staff account is not active.");
    tx.create("adminSessions", sessionId, session);
    tx.update("adminProfiles", profile.uid, { lastActiveAt: createdAt });
    recordAudit(tx, systemContext(fresh, sessionId), {
      action: "staff.sign_in",
      entityType: "adminProfile",
      entityId: profile.uid,
      summary: `Signed in (${method})`,
    });
  });
  return { cookieValue: `${sessionId}.${secret}`, expiresAt, profile };
}

/** Exchange a Firebase ID token for a staff session. Fails closed. */
export async function signInWithIdToken(store: AdminDataStore, idToken: string, userAgent?: string): Promise<IssuedSession> {
  const { projectId } = firebaseWebConfig();
  const token = await verifyFirebaseIdToken(idToken, projectId);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - token.authTime > MAX_AUTH_AGE_SECONDS) {
    throw new AdminError("unauthenticated", "Please sign in again — staff sessions need a recent sign-in.");
  }
  if (token.claims[STAFF_CLAIM] !== true) {
    throw new AdminError("forbidden", "This account has not been provisioned for staff access.");
  }
  const identity = getIdentityAdmin();
  if (await identity.isRevokedOrDisabled(token.uid, token.authTime)) {
    throw new AdminError("forbidden", "This account has been disabled or signed out by an owner.");
  }
  const profile = await store.get("adminProfiles", token.uid);
  if (!profile || profile.status !== "active") {
    throw new AdminError("forbidden", "This account has no active staff profile.");
  }
  return issueSession(store, profile, userAgent, "firebase");
}

/** DEVELOPMENT-ONLY: sign in as a fixture staff account. */
export async function signInDevelopment(store: AdminDataStore, uid: string, userAgent?: string): Promise<IssuedSession> {
  if (!devSignInEnabled() || !store.isDevelopmentData) throw new AdminError("forbidden", "Development sign-in is disabled.");
  const identity = getDevelopmentIdentity();
  if (!identity.hasStaffClaim(uid) || (await identity.isRevokedOrDisabled(uid))) {
    throw new AdminError("forbidden", "This account has not been provisioned for staff access.");
  }
  const profile = await store.get("adminProfiles", uid);
  if (!profile || profile.status !== "active") throw new AdminError("forbidden", "This account has no active staff profile.");
  return issueSession(store, profile, userAgent, "development");
}

function parseCookie(value: string | undefined): { sessionId: string; secret: string } | null {
  if (!value) return null;
  const match = /^(ses_[a-f0-9]{20})\.([A-Za-z0-9_-]{40,60})$/.exec(value);
  return match ? { sessionId: match[1], secret: match[2] } : null;
}

export type SessionResolution =
  | { ok: true; ctx: StaffContext; profile: AdminProfile }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "revoked" | "inactive" };

export async function resolveSession(store: AdminDataStore, cookieValue: string | undefined): Promise<SessionResolution> {
  const parsed = parseCookie(cookieValue);
  if (!parsed) return { ok: false, reason: cookieValue ? "invalid" : "missing" };
  const session = await store.get("adminSessions", parsed.sessionId);
  if (!session) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(session.secretHash, "hex");
  const actual = Buffer.from(sha256Hex(parsed.secret), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { ok: false, reason: "invalid" };
  if (session.revokedAt) return { ok: false, reason: "revoked" };
  if (Date.parse(session.expiresAt) <= Date.now()) return { ok: false, reason: "expired" };
  const profile = await store.get("adminProfiles", session.uid);
  if (!profile || profile.status !== "active") return { ok: false, reason: "inactive" };
  if (Date.parse(profile.sessionsValidAfter) > Date.parse(session.createdAt)) return { ok: false, reason: "revoked" };
  return {
    ok: true,
    profile,
    ctx: { uid: profile.uid, name: profile.displayName, email: profile.email, role: profile.role, sessionId: session.id, requestId: newId("req") },
  };
}

export async function revokeSession(store: AdminDataStore, cookieValue: string | undefined): Promise<void> {
  const resolved = await resolveSession(store, cookieValue);
  if (!resolved.ok) return;
  await store.runTransaction(async (tx) => {
    const session = await tx.get("adminSessions", resolved.ctx.sessionId);
    if (!session || session.revokedAt) return;
    tx.update("adminSessions", session.id, { revokedAt: nowIso() });
    recordAudit(tx, resolved.ctx, { action: "staff.sign_out", entityType: "adminProfile", entityId: resolved.ctx.uid, summary: "Signed out" });
  });
}
