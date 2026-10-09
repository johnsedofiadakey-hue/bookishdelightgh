import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, type SessionResolution } from "@/lib/admin/auth/session";
import { assertPermission, can, type StaffContext } from "@/lib/admin/context";
import { SESSION_COOKIE } from "@/lib/admin/env";
import { AdminError } from "@/lib/admin/errors";
import type { Permission } from "@/lib/admin/permissions";
import { getAdminStore } from "@/lib/admin/store";

/** Next.js bindings for the session layer. Server Components, Server Actions and Route Handlers only. */

export async function currentSession(): Promise<SessionResolution> {
  const jar = await cookies();
  return resolveSession(getAdminStore(), jar.get(SESSION_COOKIE)?.value);
}

/** For Server Actions and Route Handlers: throws instead of redirecting. */
export async function requireStaff(permission?: Permission): Promise<StaffContext> {
  const session = await currentSession();
  if (!session.ok) throw new AdminError("unauthenticated", "Your session has ended. Sign in again.");
  if (permission) assertPermission(session.ctx, permission);
  return session.ctx;
}

export type PageAccess = { ok: true; ctx: StaffContext } | { ok: false; ctx: StaffContext; permission: Permission };

/** For pages: redirects to sign-in when signed out; reports (not throws) a missing permission. */
export async function pageAccess(permission: Permission): Promise<PageAccess> {
  const session = await currentSession();
  if (!session.ok) redirect(`/admin/sign-in?reason=${session.reason}`);
  return can(session.ctx, permission) ? { ok: true, ctx: session.ctx } : { ok: false, ctx: session.ctx, permission };
}
