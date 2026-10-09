"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { bool, dateInput, idempotencyKey, list, optionalInt, runAction, text } from "@/lib/admin/actions";
import { AdminError } from "@/lib/admin/errors";
import { parseGhsToPesewas } from "@/lib/admin/format";
import { savePromotion } from "@/lib/admin/ops/promotions";

export async function savePromotionAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("promotions.edit", async ({ store, ctx }) => {
    const kind = text(form, "kind") === "percent" ? "percent" : "fixed";
    const rawValue = text(form, "value");
    let value: number;
    if (kind === "percent") {
      const percent = Number(rawValue);
      value = Number.isFinite(percent) ? Math.round(percent * 100) : Number.NaN;
    } else {
      value = parseGhsToPesewas(rawValue) ?? Number.NaN;
    }
    const minOrder = text(form, "minOrder").trim() ? parseGhsToPesewas(text(form, "minOrder")) : 0;
    if (minOrder === null) throw new AdminError("invalid", "Enter the minimum order in GHS.", { minOrderPesewas: "e.g. 150" });
    const { result } = await savePromotion(
      store,
      ctx,
      text(form, "promotionId") || null,
      {
        code: text(form, "code"),
        kind,
        value,
        minOrderPesewas: minOrder,
        eligibleCategoryIds: list(form, "eligibleCategoryIds"),
        usageLimit: optionalInt(form, "usageLimit"),
        perCustomerLimit: optionalInt(form, "perCustomerLimit"),
        startsAt: dateInput(form, "startsAt") ?? new Date().toISOString(),
        endsAt: dateInput(form, "endsAt"),
        active: bool(form, "active"),
      },
      idempotencyKey(form),
    );
    return { message: "Promotion saved. Checkout validates it server-side.", data: { promotionId: result.promotionId } };
  });
}
