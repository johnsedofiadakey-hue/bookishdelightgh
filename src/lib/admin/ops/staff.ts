import { recordAudit } from "@/lib/admin/audit";
import { getIdentityAdmin } from "@/lib/admin/auth/identity";
import { assertPermission, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";
import { SCHEMA_VERSION, STAFF_ROLES, type AdminProfile, type StaffRole, type StaffStatus } from "@/lib/admin/types";
import { isValidEmail } from "@/lib/admin/validation";

/**
 * Staff management (owner only). There is no public sign-up path to admin:
 * the person must already exist in Firebase Auth (created by the owner in the
 * Firebase console or via an invite flow from shared Firebase), and an owner
 * provisions their profile + coarse claim here. The very first owner is
 * bootstrapped out-of-band (ADMIN_INTEGRATION_NOTES.md, request R2).
 */

function assertRole(role: string): asserts role is StaffRole {
  if (!(STAFF_ROLES as readonly string[]).includes(role)) throw new AdminError("invalid", "Choose a role.", { role: "Required" });
}

async function activeOwnerCount(tx: AdminTransaction): Promise<number> {
  const owners = await tx.query("adminProfiles", { where: [["role", "==", "owner"]] });
  return owners.filter((profile) => profile.status === "active").length;
}

export async function provisionStaff(store: AdminDataStore, ctx: StaffContext, input: { email: string; displayName: string; role: string }, idempotencyKey: string) {
  assertPermission(ctx, "staff.manage");
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) throw new AdminError("invalid", "Enter the staff member's sign-in email.", { email: "Invalid email" });
  assertRole(input.role);
  const displayName = input.displayName.trim();
  if (!displayName) throw new AdminError("invalid", "Enter their name.", { displayName: "Required" });
  const identity = getIdentityAdmin();
  const user = await identity.findUserByEmail(email);
  if (!user) throw new AdminError("not_found", "No Firebase Auth user has this email. Create the user in Firebase Authentication first, then provision them here.", { email: "Not found in Firebase Auth" });
  const role = input.role;
  const result = await runIdempotent(store, ctx, "staff.provision", idempotencyKey, async (tx) => {
    const existing = await tx.get("adminProfiles", user.uid);
    if (existing && existing.status !== "revoked") throw new AdminError("conflict", "This person already has a staff profile.");
    const at = nowIso();
    const profile: AdminProfile = {
      uid: user.uid,
      email,
      displayName,
      role,
      status: "active",
      sessionsValidAfter: at,
      createdAt: existing?.createdAt ?? at,
      createdBy: ctx.uid,
      updatedAt: at,
      schemaVersion: SCHEMA_VERSION,
    };
    tx.set("adminProfiles", user.uid, profile);
    recordAudit(tx, ctx, { action: "staff.provision", entityType: "adminProfile", entityId: user.uid, summary: `Provisioned ${displayName} as ${role}`, after: { role, email } });
    return { uid: user.uid };
  });
  if (!result.replayed) await identity.setStaffClaim(user.uid, true);
  return result;
}

export async function changeStaffRole(store: AdminDataStore, ctx: StaffContext, uid: string, role: string, reason: string, idempotencyKey: string) {
  assertPermission(ctx, "staff.manage");
  assertRole(role);
  if (uid === ctx.uid) throw new AdminError("forbidden", "You cannot change your own role. Ask another owner.");
  if (reason.trim().length < 4) throw new AdminError("invalid", "Record why the role is changing.", { reason: "Required" });
  return runIdempotent(store, ctx, "staff.role", idempotencyKey, async (tx) => {
    const profile = await tx.get("adminProfiles", uid);
    if (!profile) throw new AdminError("not_found", "Staff member not found.");
    if (profile.role === role) return { uid };
    if (profile.role === "owner" && profile.status === "active" && (await activeOwnerCount(tx)) <= 1) throw new AdminError("precondition", "There must always be at least one active owner.");
    const at = nowIso();
    // Role changes end existing sessions so the new permissions apply immediately.
    tx.update("adminProfiles", uid, { role, updatedAt: at, sessionsValidAfter: at });
    recordAudit(tx, ctx, { action: "staff.role", entityType: "adminProfile", entityId: uid, summary: `${profile.displayName}: ${profile.role} → ${role}`, reason: reason.trim(), before: { role: profile.role }, after: { role } });
    return { uid };
  });
}

export async function setStaffStatus(store: AdminDataStore, ctx: StaffContext, uid: string, status: StaffStatus, reason: string, idempotencyKey: string) {
  assertPermission(ctx, "staff.manage");
  if (uid === ctx.uid) throw new AdminError("forbidden", "You cannot suspend or revoke your own access.");
  if (reason.trim().length < 4) throw new AdminError("invalid", "Record a reason.", { reason: "Required" });
  const result = await runIdempotent(store, ctx, `staff.status.${status}`, idempotencyKey, async (tx) => {
    const profile = await tx.get("adminProfiles", uid);
    if (!profile) throw new AdminError("not_found", "Staff member not found.");
    if (profile.status === status) return { uid, changed: false };
    if (profile.role === "owner" && status !== "active" && (await activeOwnerCount(tx)) <= 1) throw new AdminError("precondition", "There must always be at least one active owner.");
    const at = nowIso();
    tx.update("adminProfiles", uid, { status, updatedAt: at, sessionsValidAfter: at });
    recordAudit(tx, ctx, { action: `staff.${status}`, entityType: "adminProfile", entityId: uid, summary: `${profile.displayName}: ${profile.status} → ${status}`, reason: reason.trim() });
    return { uid, changed: true };
  });
  if (!result.replayed && result.result.changed) await getIdentityAdmin().setStaffClaim(uid, status === "active");
  return result;
}

export async function signOutEverywhere(store: AdminDataStore, ctx: StaffContext, uid: string, idempotencyKey: string) {
  if (uid !== ctx.uid) assertPermission(ctx, "staff.manage");
  return runIdempotent(store, ctx, "staff.signOutEverywhere", idempotencyKey, async (tx) => {
    const profile = await tx.get("adminProfiles", uid);
    if (!profile) throw new AdminError("not_found", "Staff member not found.");
    tx.update("adminProfiles", uid, { sessionsValidAfter: nowIso() });
    recordAudit(tx, ctx, { action: "staff.signOutEverywhere", entityType: "adminProfile", entityId: uid, summary: `Ended all sessions for ${profile.displayName}` });
    return { uid };
  });
}

export async function listStaff(store: AdminDataStore, ctx: StaffContext): Promise<AdminProfile[]> {
  assertPermission(ctx, "staff.view");
  const profiles = await store.query("adminProfiles");
  return profiles.sort((left, right) => STAFF_ROLES.indexOf(left.role) - STAFF_ROLES.indexOf(right.role) || left.displayName.localeCompare(right.displayName));
}
