import { devSignInEnabled } from "@/lib/admin/env";
import { AdminError } from "@/lib/admin/errors";
import { getAuth } from "firebase-admin/auth";
import { FirebaseIdentityAdmin, getAdapterApp } from "@/lib/firebase/admin-adapters";

/**
 * Privileged Firebase Auth operations the admin needs but cannot perform
 * without the Admin SDK. The shared Firebase owner registers a production
 * implementation (see ADMIN_INTEGRATION_NOTES.md, request R2):
 *
 * - `isRevokedOrDisabled`: `auth.getUser(uid)` → `disabled`, or
 *   `tokensValidAfterTime > authTime`.
 * - `setStaffClaim`: `auth.setCustomUserClaims(uid, { ...existing, bookish_staff })`
 *   and `auth.revokeRefreshTokens(uid)` when removing.
 * - `findUserByEmail`: `auth.getUserByEmail(email)`.
 */
export interface IdentityAdmin {
  readonly kind: "firebase" | "development";
  isRevokedOrDisabled(uid: string, authTimeSeconds: number): Promise<boolean>;
  setStaffClaim(uid: string, staff: boolean): Promise<void>;
  findUserByEmail(email: string): Promise<{ uid: string; email: string; displayName?: string } | null>;
}

/** The coarse custom claim every staff Firebase user must carry. */
export const STAFF_CLAIM = "bookish_staff";

type RegisteredIdentityGlobal = typeof globalThis & { __bookishRegisteredIdentity?: IdentityAdmin };

export function registerIdentityAdmin(identity: IdentityAdmin): void {
  (globalThis as RegisteredIdentityGlobal).__bookishRegisteredIdentity = identity;
}

type DevIdentityGlobal = typeof globalThis & { __bookishDevIdentity?: DevelopmentIdentityAdmin };

/** DEVELOPMENT-ONLY identity directory backing the fixture staff accounts. */
export class DevelopmentIdentityAdmin implements IdentityAdmin {
  readonly kind = "development" as const;
  readonly users = new Map<string, { uid: string; email: string; displayName: string; staffClaim: boolean; disabled: boolean }>();

  async isRevokedOrDisabled(uid: string): Promise<boolean> {
    const user = this.users.get(uid);
    return !user || user.disabled;
  }

  async setStaffClaim(uid: string, staff: boolean): Promise<void> {
    const user = this.users.get(uid);
    if (!user) throw new AdminError("not_found", "No such development user.");
    user.staffClaim = staff;
  }

  async findUserByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) if (user.email === normalized) return user;
    return null;
  }

  hasStaffClaim(uid: string): boolean {
    return this.users.get(uid)?.staffClaim === true;
  }
}

export function getDevelopmentIdentity(): DevelopmentIdentityAdmin {
  const holder = globalThis as DevIdentityGlobal;
  holder.__bookishDevIdentity ??= new DevelopmentIdentityAdmin();
  return holder.__bookishDevIdentity;
}

export function getIdentityAdmin(): IdentityAdmin {
  if (devSignInEnabled()) return getDevelopmentIdentity();
  const holder = globalThis as RegisteredIdentityGlobal;
  if (holder.__bookishRegisteredIdentity) return holder.__bookishRegisteredIdentity;
  holder.__bookishRegisteredIdentity = new FirebaseIdentityAdmin(getAuth(getAdapterApp()));
  return holder.__bookishRegisteredIdentity;
}
