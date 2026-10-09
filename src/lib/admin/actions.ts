import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { requireStaff } from "@/lib/admin/auth/guard";
import type { StaffContext } from "@/lib/admin/context";
import { isAdminError } from "@/lib/admin/errors";
import type { Permission } from "@/lib/admin/permissions";
import { getAdminStore } from "@/lib/admin/store";
import type { AdminDataStore } from "@/lib/admin/store/types";

/**
 * Wraps a Server Action body: verifies the staff session and permission on
 * the server for every call (so calling the action endpoint directly is
 * checked exactly like a button press), maps AdminErrors to form state, and
 * refreshes the router on success.
 */
export async function runAction(
  permission: Permission,
  work: (args: { store: AdminDataStore; ctx: StaffContext }) => Promise<Partial<ActionState> & { message: string }>,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff(permission);
    const result = await work({ store: getAdminStore(), ctx });
    refresh();
    return { status: "success", at: Date.now(), ...result };
  } catch (error) {
    unstable_rethrow(error);
    if (isAdminError(error)) return { status: "error", message: error.message, fieldErrors: error.fieldErrors, at: Date.now() };
    console.error("[admin action]", error);
    return { status: "error", message: "Something went wrong on the server. Nothing was saved. Try again or contact the owner.", at: Date.now() };
  }
}

/* --------------------------------------------------------- Form parsing */

export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function optionalText(form: FormData, name: string): string | undefined {
  const value = text(form, name).trim();
  return value ? value : undefined;
}

export function int(form: FormData, name: string, fallback = Number.NaN): number {
  const raw = text(form, name).trim();
  if (!raw) return fallback;
  return /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

export function optionalInt(form: FormData, name: string): number | undefined {
  const raw = text(form, name).trim();
  if (!raw) return undefined;
  return /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

export function bool(form: FormData, name: string): boolean {
  const value = form.get(name);
  return value === "on" || value === "true" || value === "1";
}

export function list(form: FormData, name: string): string[] {
  return form.getAll(name).filter((value): value is string => typeof value === "string" && value.trim() !== "");
}

export function idempotencyKey(form: FormData): string {
  return text(form, "idempotencyKey");
}

/** Converts a date input (YYYY-MM-DD) into an ISO instant at Accra midnight (UTC). */
export function dateInput(form: FormData, name: string): string | undefined {
  const raw = text(form, name).trim();
  if (!raw) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : "invalid";
}
