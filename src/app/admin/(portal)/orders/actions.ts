"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { bool, idempotencyKey, list, optionalText, runAction, text } from "@/lib/admin/actions";
import { AdminError } from "@/lib/admin/errors";
import { parseGhsToPesewas } from "@/lib/admin/format";
import { addStaffNote, approveManualPayment, createManualSale, requestRefund, setCourierDetails, transitionFulfilment, type ManualSaleInput } from "@/lib/admin/ops/orders";
import type { FulfilmentStatus, ManualChannel, PaymentRecord } from "@/lib/admin/types";

export async function transitionAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const to = text(form, "to") as FulfilmentStatus;
  return runAction(to === "cancelled" ? "orders.cancel" : "orders.fulfil", async ({ store, ctx }) => {
    const { replayed } = await transitionFulfilment(store, ctx, {
      orderId: text(form, "orderId"),
      expectedFrom: text(form, "expectedFrom") as FulfilmentStatus,
      to,
      note: optionalText(form, "note"),
      courier: optionalText(form, "courier"),
      trackingReference: optionalText(form, "trackingReference"),
      deliveryProofNote: optionalText(form, "deliveryProofNote"),
      restock: bool(form, "restock"),
      idempotencyKey: idempotencyKey(form),
    });
    return { message: replayed ? "Already done — duplicate click ignored." : `Order marked ${to}.` };
  });
}

export async function noteAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("orders.view", async ({ store, ctx }) => {
    await addStaffNote(store, ctx, text(form, "orderId"), text(form, "body"), idempotencyKey(form));
    return { message: "Note added." };
  });
}

export async function courierAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("orders.fulfil", async ({ store, ctx }) => {
    await setCourierDetails(store, ctx, text(form, "orderId"), text(form, "courier"), text(form, "trackingReference"), idempotencyKey(form));
    return { message: "Courier details saved." };
  });
}

export async function approvePaymentAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("payments.approve_manual", async ({ store, ctx }) => {
    await approveManualPayment(store, ctx, text(form, "orderId"), idempotencyKey(form));
    return { message: "Payment approved. The order is paid and stock is committed." };
  });
}

export async function refundAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("payments.refund", async ({ store, ctx }) => {
    const amount = parseGhsToPesewas(text(form, "amount"));
    if (amount === null) throw new AdminError("invalid", "Enter the refund amount in GHS.", { amount: "e.g. 95.00" });
    const outcome = await requestRefund(store, ctx, { orderId: text(form, "orderId"), amountPesewas: amount, reason: text(form, "reason"), manualEvidence: optionalText(form, "manualEvidence"), idempotencyKey: idempotencyKey(form) });
    if (outcome.replayed) return { message: "Already recorded — duplicate submission ignored." };
    if (outcome.result.provider === "manual") return { message: "Manual refund recorded." };
    return {
      message:
        outcome.gateway === "not_connected"
          ? "Refund request recorded. Paystack submission is not connected yet (shared request R5), so no money has moved. The order shows “Refund pending”."
          : `Refund submitted to Paystack (${outcome.gateway}).`,
    };
  });
}

export async function manualSaleAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("orders.manual_sale", async ({ store, ctx }) => {
    const skus = list(form, "lineSku");
    const quantities = form.getAll("lineQty").map((value) => Number(value));
    const amount = parseGhsToPesewas(text(form, "amount"));
    if (amount === null) throw new AdminError("invalid", "Enter the amount received in GHS.", { amount: "e.g. 215.00" });
    const input: ManualSaleInput = {
      manualChannel: text(form, "manualChannel") as ManualChannel,
      customer: { name: text(form, "name"), phone: text(form, "phone"), email: optionalText(form, "email") },
      address: { region: text(form, "region"), city: text(form, "city"), addressLine: text(form, "addressLine"), ghanaPostGps: optionalText(form, "ghanaPostGps"), landmark: optionalText(form, "landmark"), notes: optionalText(form, "notes") },
      lines: skus.map((sku, index) => ({ sku, quantity: Number.isFinite(quantities[index]) ? quantities[index] : 0 })),
      deliveryRateId: text(form, "deliveryRateId"),
      payment: { method: text(form, "method") as NonNullable<PaymentRecord["manualMethod"]>, evidence: text(form, "evidence"), amountPesewas: amount },
      idempotencyKey: idempotencyKey(form),
    };
    const { result } = await createManualSale(store, ctx, input);
    return { message: result.approved ? `Manual sale ${result.ref} recorded and paid.` : `Manual sale ${result.ref} recorded; awaiting payment approval by a manager.`, redirectTo: `/admin/orders/${result.orderId}` };
  });
}
