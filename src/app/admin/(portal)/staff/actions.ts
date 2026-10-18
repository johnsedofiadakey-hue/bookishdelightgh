"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { idempotencyKey, runAction, text } from "@/lib/admin/actions";
import { AdminError } from "@/lib/admin/errors";
import { changeStaffRole, provisionStaff, setStaffStatus, signOutEverywhere } from "@/lib/admin/ops/staff";
import type { StaffStatus } from "@/lib/admin/types";

export async function provisionStaffAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    await provisionStaff(store, ctx, { email: text(form, "email"), displayName: text(form, "displayName"), role: text(form, "role") }, idempotencyKey(form));
    return { message: "Staff member added. They can now sign in with their email and password." };
  });
}

export async function changeRoleAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    await changeStaffRole(store, ctx, text(form, "uid"), text(form, "role"), text(form, "reason"), idempotencyKey(form));
    return { message: "Role changed. They’ve been signed out so the new role works right away." };
  });
}

export async function setStatusAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    const status = text(form, "status") as StaffStatus;
    if (!["active", "suspended", "revoked"].includes(status)) throw new AdminError("invalid", "That status isn’t valid.");
    await setStaffStatus(store, ctx, text(form, "uid"), status, text(form, "reason"), idempotencyKey(form));
    return { message: status === "active" ? "Access restored." : status === "suspended" ? "Access suspended and sessions ended." : "Access revoked and staff claim removed." };
  });
}

export async function endSessionsAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("staff.manage", async ({ store, ctx }) => {
    await signOutEverywhere(store, ctx, text(form, "uid"), idempotencyKey(form));
    return { message: "They’ve been signed out on every device." };
  });
}
