"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { revokeSession, signInDevelopment } from "@/lib/admin/auth/session";
import { isProductionRuntime, SESSION_COOKIE } from "@/lib/admin/env";
import { isAdminError } from "@/lib/admin/errors";
import { getAdminStore } from "@/lib/admin/store";

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  await revokeSession(getAdminStore(), jar.get(SESSION_COOKIE)?.value);
  jar.delete({ name: SESSION_COOKIE, path: "/admin" });
  redirect("/admin/sign-in?reason=signed_out");
}

/** DEVELOPMENT-ONLY sign-in as a fixture staff account. Refused unless the dev store is active. */
export async function devSignInAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const uid = form.get("uid");
  if (typeof uid !== "string") return { status: "error", message: "Choose an account.", at: Date.now() };
  try {
    const userAgent = (await headers()).get("user-agent") ?? undefined;
    const issued = await signInDevelopment(getAdminStore(), uid, userAgent);
    const jar = await cookies();
    jar.set({ name: SESSION_COOKIE, value: issued.cookieValue, httpOnly: true, secure: isProductionRuntime(), sameSite: "strict", path: "/admin", expires: new Date(issued.expiresAt) });
  } catch (error) {
    if (isAdminError(error)) return { status: "error", message: error.message, at: Date.now() };
    throw error;
  }
  redirect("/admin");
}
