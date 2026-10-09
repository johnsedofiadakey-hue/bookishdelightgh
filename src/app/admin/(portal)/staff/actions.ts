"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { idempotencyKey, runAction, text } from "@/lib/admin/actions";
import { AdminError } from "@/lib/admin/errors";
import { changeStaffRole, provisionStaff, setStaffStatus, signOutEverywhere } from "@/lib/admin/ops/staff";
import type { StaffStatus } from "@/lib/admin/types";

export async function provisionStaffAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    await provisionStaff(store, ctx, { email: text(form, "email"), displayName: text(form, "displayName"), role: text(form, "role") }, idempotencyKey(form));
    return { message: "Staff access granted. They can sign in with their existing Firebase account." };
  });
}

export async function changeRoleAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    await changeStaffRole(store, ctx, text(form, "uid"), text(form, "role"), text(form, "reason"), idempotencyKey(form));
    return { message: "Role changed. Their open sessions were ended so the new permissions apply immediately." };
  });
}

export async function setStatusAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    const status = text(form, "status") as StaffStatus;
    if (!["active", "suspended", "revoked"].includes(status)) throw new AdminError("invalid", "Unknown status.");
    await setStaffStatus(store, ctx, text(form, "uid"), status, text(form, "reason"), idempotencyKey(form));
    return { message: status === "active" ? "Access restored." : status === "suspended" ? "Access suspended and sessions ended." : "Access revoked and staff claim removed." };
  });
}

export async function endSessionsAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    await signOutEverywhere(store, ctx, text(form, "uid"), idempotencyKey(form));
    return { message: "All of their sessions were ended." };
  });
}
