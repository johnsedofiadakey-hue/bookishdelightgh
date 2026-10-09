"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { bool, idempotencyKey, int, runAction, text } from "@/lib/admin/actions";
import { updateSettings } from "@/lib/admin/ops/content";
import { signOutEverywhere } from "@/lib/admin/ops/staff";
import { isGhanaRegion } from "@/lib/admin/validation";
import { AdminError } from "@/lib/admin/errors";

export async function saveSettingsAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("settings.edit", async ({ store, ctx }) => {
    const region = text(form, "originRegion");
    if (!isGhanaRegion(region)) throw new AdminError("invalid", "Choose the fulfilment region.", { originRegion: "Required" });
    await updateSettings(
      store,
      ctx,
      {
        supportPhone: text(form, "supportPhone").trim(),
        supportEmail: text(form, "supportEmail").trim(),
        supportWhatsApp: text(form, "supportWhatsApp").trim(),
        fulfilmentOrigin: { region, city: text(form, "originCity").trim(), addressLine: text(form, "originAddress").trim() },
        returnsPolicyUrl: text(form, "returnsPolicyUrl").trim(),
        defaultLowStockThreshold: int(form, "defaultLowStockThreshold"),
        checkoutEnabled: bool(form, "checkoutEnabled"),
        smsEnabled: bool(form, "smsEnabled"),
        maintenanceBanner: text(form, "maintenanceBanner").trim(),
      },
      idempotencyKey(form),
    );
    return { message: "Settings saved." };
  });
}

export async function signOutEverywhereAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("dashboard.view", async ({ store, ctx }) => {
    await signOutEverywhere(store, ctx, ctx.uid, idempotencyKey(form));
    return { message: "All your sessions have ended.", redirectTo: "/admin/sign-in?reason=revoked" };
  });
}
