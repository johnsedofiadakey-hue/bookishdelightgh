import { AdminError } from "@/lib/admin/errors";
import { roleHas, type Permission } from "@/lib/admin/permissions";
import type { StaffRole } from "@/lib/admin/types";

/**
 * The verified identity every admin operation receives. It is only ever built
 * by the session layer after checking the session cookie, the active
 * `adminProfiles/{uid}` record and its role.
 */
export interface StaffContext {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
  sessionId: string;
  requestId: string;
}

export function can(ctx: Pick<StaffContext, "role">, permission: Permission): boolean {
  return roleHas(ctx.role, permission);
}

export function assertPermission(ctx: StaffContext, permission: Permission): void {
  if (!roleHas(ctx.role, permission)) {
    throw new AdminError("forbidden", `Your role does not allow this action (${permission}).`);
  }
}
