"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { idempotencyKey, int, optionalText, runAction, text } from "@/lib/admin/actions";
import { assembleBundles, unpackBundles } from "@/lib/admin/ops/bundles";
import { adjustStock, receiveStock, setLowStockThreshold, type AdjustmentType } from "@/lib/admin/ops/inventory";

export async function receiveStockAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("inventory.receive", async ({ store, ctx }) => {
    const { result, replayed } = await receiveStock(store, ctx, { sku: text(form, "sku"), quantity: int(form, "quantity"), reference: text(form, "reference"), note: optionalText(form, "note"), idempotencyKey: idempotencyKey(form) });
    return { message: replayed ? "Already recorded — this was a duplicate submission." : `Received. On hand is now ${result.onHand} (${result.available} available).` };
  });
}

export async function adjustStockAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("inventory.adjust", async ({ store, ctx }) => {
    const { result, replayed } = await adjustStock(store, ctx, {
      sku: text(form, "sku"),
      type: text(form, "type") as AdjustmentType,
      quantity: int(form, "quantity"),
      reason: text(form, "reason"),
      reference: text(form, "reference"),
      idempotencyKey: idempotencyKey(form),
    });
    return { message: replayed ? "Already recorded — this was a duplicate submission." : `Adjusted. On hand is now ${result.onHand} (${result.available} available).` };
  });
}

export async function thresholdAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("inventory.adjust", async ({ store, ctx }) => {
    await setLowStockThreshold(store, ctx, text(form, "sku"), int(form, "threshold"), idempotencyKey(form));
    return { message: "Threshold saved." };
  });
}

export async function assembleBundlesAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("inventory.adjust", async ({ store, ctx }) => {
    const { result, replayed } = await assembleBundles(store, ctx, { bundleSku: text(form, "sku"), quantity: int(form, "quantity"), reference: text(form, "reference"), idempotencyKey: idempotencyKey(form) });
    return { message: replayed ? "Already recorded — duplicate submission ignored." : `Made up. ${result.onHand} bundle(s) now in stock; the books inside were taken out of single stock.` };
  });
}

export async function unpackBundlesAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("inventory.adjust", async ({ store, ctx }) => {
    const { result, replayed } = await unpackBundles(store, ctx, { bundleSku: text(form, "sku"), quantity: int(form, "quantity"), reference: text(form, "reference"), idempotencyKey: idempotencyKey(form) });
    return { message: replayed ? "Already recorded — duplicate submission ignored." : `Unpacked. ${result.onHand} bundle(s) left; the books are back in single stock.` };
  });
}
