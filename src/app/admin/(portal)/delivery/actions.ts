"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { dateInput, idempotencyKey, int, runAction, text } from "@/lib/admin/actions";
import { AdminError } from "@/lib/admin/errors";
import { parseGhsToPesewas } from "@/lib/admin/format";
import { createRate, deactivateRate, reviseRate, type RateInput } from "@/lib/admin/ops/delivery";
import type { DeliveryRate } from "@/lib/admin/types";
import { splitList } from "@/lib/admin/validation";

function rateInput(form: FormData): RateInput {
  const price = parseGhsToPesewas(text(form, "price"));
  const minOrder = text(form, "minOrder").trim() ? parseGhsToPesewas(text(form, "minOrder")) : 0;
  if (price === null) throw new AdminError("invalid", "Enter the delivery price in GHS.", { pricePesewas: "e.g. 25.00" });
  if (minOrder === null) throw new AdminError("invalid", "Enter the minimum order in GHS or leave blank.", { minOrderPesewas: "e.g. 100" });
  const activeFrom = dateInput(form, "activeFrom") ?? new Date().toISOString();
  return {
    name: text(form, "name"),
    region: text(form, "region"),
    cities: splitList(text(form, "cities")),
    serviceLevel: text(form, "serviceLevel") as DeliveryRate["serviceLevel"],
    minWeightGrams: int(form, "minWeightGrams", 0),
    maxWeightGrams: int(form, "maxWeightGrams"),
    minOrderPesewas: minOrder,
    pricePesewas: price,
    estimate: text(form, "estimate"),
    activeFrom,
    activeTo: dateInput(form, "activeTo"),
  };
}

export async function saveRateAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const rateId = text(form, "rateId");
  return runAction("delivery.edit", async ({ store, ctx }) => {
    if (rateId) {
      const { result } = await reviseRate(store, ctx, rateId, rateInput(form), idempotencyKey(form));
      return { message: "Saved as a new version. Existing orders keep the price they were quoted.", data: { rateId: result.rateId } };
    }
    await createRate(store, ctx, rateInput(form), idempotencyKey(form));
    return { message: "Rate created." };
  });
}

export async function deactivateRateAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("delivery.edit", async ({ store, ctx }) => {
    await deactivateRate(store, ctx, text(form, "rateId"), idempotencyKey(form));
    return { message: "Rate deactivated. Checkout will no longer offer it." };
  });
}
