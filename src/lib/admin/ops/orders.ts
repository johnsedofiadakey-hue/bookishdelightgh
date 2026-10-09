import { pick, recordAudit, stripUndefined } from "@/lib/admin/audit";
import { assertPermission, can, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { maskEmail, maskPhone } from "@/lib/admin/format";
import { derivedId, newId, newOrderRef, nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import { applyMovement } from "@/lib/admin/ops/inventory";
import { enqueueOrderSms, readNotificationSlot } from "@/lib/admin/ops/notifications";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";
import {
  SCHEMA_VERSION,
  type FulfilmentStatus,
  type InventoryRecord,
  type ManualChannel,
  type Order,
  type OrderLineSnapshot,
  type PaymentRecord,
  type PaymentStatus,
  type RefundRecord,
} from "@/lib/admin/types";
import { isGhanaRegion, isValidEmail, normalizeGhanaPhone } from "@/lib/admin/validation";

/* ---------------------------------------------------------- State machine */

/**
 * Allowed fulfilment transitions. Payment state is separate and is never
 * changed by a fulfilment action.
 */
export const FULFILMENT_TRANSITIONS: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  new: ["picking", "cancelled", "exception"],
  picking: ["packed", "new", "cancelled", "exception"],
  packed: ["dispatched", "picking", "cancelled", "exception"],
  dispatched: ["delivered", "returned", "exception"],
  delivered: ["returned"],
  exception: ["new", "picking", "packed", "dispatched", "cancelled"],
  cancelled: [],
  returned: [],
};

/** Statuses that physically commit stock to the customer: only for verified payment. */
const NEEDS_VERIFIED_PAYMENT: ReadonlySet<FulfilmentStatus> = new Set(["picking", "packed", "dispatched", "delivered"]);

/** Payment states that count as verified money received (refunds may follow). */
export const SETTLED_PAYMENT: ReadonlySet<PaymentStatus> = new Set(["paid", "partially_refunded", "refund_pending"]);

export function canTransition(order: Pick<Order, "fulfilmentStatus" | "paymentStatus">, to: FulfilmentStatus): { ok: true } | { ok: false; reason: string } {
  if (!FULFILMENT_TRANSITIONS[order.fulfilmentStatus].includes(to)) {
    return { ok: false, reason: `An order that is ${order.fulfilmentStatus} cannot move to ${to}.` };
  }
  if (NEEDS_VERIFIED_PAYMENT.has(to) && !SETTLED_PAYMENT.has(order.paymentStatus)) {
    return { ok: false, reason: "Payment has not been verified. Unpaid orders cannot be picked, packed or dispatched." };
  }
  if (NEEDS_VERIFIED_PAYMENT.has(to) && order.paymentStatus === "refund_pending") {
    return { ok: false, reason: "A refund is in progress; resolve it before continuing fulfilment." };
  }
  return { ok: true };
}

export interface TransitionInput {
  orderId: string;
  /** The status the staff member saw; guards against stale pages. */
  expectedFrom: FulfilmentStatus;
  to: FulfilmentStatus;
  note?: string;
  courier?: string;
  trackingReference?: string;
  deliveryProofNote?: string;
  /** For `returned`: whether the returned copies go back on the shelf. */
  restock?: boolean;
  idempotencyKey: string;
}

/** Release reservations or restock sold copies for every line of an order. */
async function readOrderInventory(tx: AdminTransaction, order: Order): Promise<Map<string, InventoryRecord>> {
  const records = new Map<string, InventoryRecord>();
  for (const line of order.lines) {
    if (records.has(line.sku)) continue;
    const record = await tx.get("inventory", line.sku);
    if (!record) throw new AdminError("not_found", `Inventory for ${line.sku} is missing.`);
    records.set(line.sku, record);
  }
  return records;
}

function moveOrderStock(
  tx: AdminTransaction,
  ctx: StaffContext,
  order: Order,
  records: Map<string, InventoryRecord>,
  kind: "release" | "sell" | "restock" | "reserve" | "sellDirect",
  reason: string,
) {
  order.lines.forEach((line, index) => {
    const record = records.get(line.sku)!;
    const deltas = {
      reserve: { type: "ORDER_RESERVED" as const, onHandDelta: 0, reservedDelta: line.quantity },
      release: { type: "ORDER_RELEASED" as const, onHandDelta: 0, reservedDelta: -line.quantity },
      sell: { type: "ORDER_SOLD" as const, onHandDelta: -line.quantity, reservedDelta: -line.quantity },
      restock: { type: "ORDER_CANCELLED_RESTOCK" as const, onHandDelta: line.quantity, reservedDelta: 0 },
      // Paid-at-creation manual sale: one movement per SKU, no reserve/sell pair.
      sellDirect: { type: "ORDER_SOLD" as const, onHandDelta: -line.quantity, reservedDelta: 0 },
    }[kind];
    const movementId = derivedId("mov", "order", order.id, kind, line.sku, String(index));
    const next = applyMovement(tx, ctx, record, { sku: line.sku, ...deltas, reason, reference: order.ref, orderId: order.id }, movementId);
    records.set(line.sku, next);
  });
}

export async function transitionFulfilment(store: AdminDataStore, ctx: StaffContext, input: TransitionInput) {
  assertPermission(ctx, input.to === "cancelled" ? "orders.cancel" : "orders.fulfil");
  return runIdempotent(store, ctx, "orders.transition", input.idempotencyKey, async (tx) => {
    const order = await tx.get("orders", input.orderId);
    if (!order) throw new AdminError("not_found", "Order not found.");
    if (order.fulfilmentStatus !== input.expectedFrom) {
      throw new AdminError("conflict", `This order is now ${order.fulfilmentStatus} (someone else updated it). Reload to see the latest.`);
    }
    const check = canTransition(order, input.to);
    if (!check.ok) throw new AdminError("precondition", check.reason);

    const at = nowIso();
    const patch: Partial<Order> = {};
    let stockAction: "release" | "restock" | null = null;

    if (input.to === "dispatched") {
      const courier = input.courier?.trim() || order.courier;
      if (!courier) throw new AdminError("invalid", "Enter the courier before dispatching.", { courier: "Required" });
      patch.courier = courier;
      const tracking = input.trackingReference?.trim() || order.trackingReference;
      if (tracking) patch.trackingReference = tracking;
      patch.dispatchedAt = at;
    }
    if (input.to === "delivered") {
      patch.deliveredAt = at;
      if (input.deliveryProofNote?.trim()) patch.deliveryProofNote = input.deliveryProofNote.trim().slice(0, 500);
    }
    if (input.to === "cancelled") {
      if (!input.note?.trim()) throw new AdminError("invalid", "Give a reason for cancelling.", { note: "Required" });
      if (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") {
        throw new AdminError("precondition", "This order has been paid. Start a refund first; then it can be cancelled.");
      }
      if (order.stockState === "reserved") stockAction = "release";
      else if (order.stockState === "sold") stockAction = "restock";
    }
    if (input.to === "returned") {
      if (!input.note?.trim()) throw new AdminError("invalid", "Record why the order came back.", { note: "Required" });
      if (input.restock && order.stockState === "sold") stockAction = "restock";
    }
    if (input.to === "exception" && !input.note?.trim()) throw new AdminError("invalid", "Describe the exception.", { note: "Required" });

    const records = stockAction ? await readOrderInventory(tx, order) : null;
    const settings = await tx.get("siteSettings", "site");
    const smsEvent = input.to === "dispatched" ? "order_dispatched" : input.to === "delivered" ? "order_delivered" : input.to === "cancelled" ? "order_cancelled" : null;
    const smsSlot = smsEvent ? await readNotificationSlot(tx, order.id, smsEvent) : null;

    // ---- writes
    if (records && stockAction) {
      moveOrderStock(tx, ctx, order, records, stockAction, stockAction === "release" ? "Order cancelled before payment/shipping" : `Order ${input.to}: copies back on shelf`);
      patch.stockState = stockAction === "release" ? "released" : "restocked";
    }
    if (input.to === "exception") {
      patch.exception = { kind: "other", detail: input.note!.trim().slice(0, 500), raisedAt: at };
    } else if (order.fulfilmentStatus === "exception" && order.exception && !order.exception.resolvedAt) {
      patch.exception = { ...order.exception, resolvedAt: at };
    }
    const event = stripUndefined({ from: order.fulfilmentStatus, to: input.to, actorUid: ctx.uid, actorName: ctx.name, at, note: input.note?.trim() || undefined });
    const next: Order = { ...order, ...patch, fulfilmentStatus: input.to, fulfilmentHistory: [...order.fulfilmentHistory, event], updatedAt: at };
    tx.set("orders", order.id, stripUndefined(next));
    if (smsEvent) enqueueOrderSms(tx, next, smsEvent, smsSlot, settings?.smsEnabled ?? false);
    recordAudit(tx, ctx, {
      action: `orders.fulfilment.${input.to}`,
      entityType: "order",
      entityId: order.id,
      summary: `${order.ref}: ${order.fulfilmentStatus} → ${input.to}`,
      reason: input.note?.trim() || undefined,
      before: pick(order, ["fulfilmentStatus", "stockState"]),
      after: pick(next, ["fulfilmentStatus", "stockState", "courier", "trackingReference"]),
    });
    return { orderId: order.id, status: input.to };
  });
}

export async function addStaffNote(store: AdminDataStore, ctx: StaffContext, orderId: string, body: string, idempotencyKey: string) {
  assertPermission(ctx, "orders.view");
  if (!can(ctx, "orders.fulfil") && !can(ctx, "customers.view")) throw new AdminError("forbidden", "Your role cannot add order notes.");
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 1000) throw new AdminError("invalid", "Write a note (max 1,000 characters).", { body: "Required" });
  return runIdempotent(store, ctx, "orders.note", idempotencyKey, async (tx) => {
    const order = await tx.get("orders", orderId);
    if (!order) throw new AdminError("not_found", "Order not found.");
    const note = { id: newId("note"), body: trimmed, actorUid: ctx.uid, actorName: ctx.name, at: nowIso() };
    tx.update("orders", orderId, { staffNotes: [...order.staffNotes, note], updatedAt: note.at });
    recordAudit(tx, ctx, { action: "orders.note", entityType: "order", entityId: orderId, summary: `Note on ${order.ref}` });
    return { noteId: note.id };
  });
}

export async function setCourierDetails(store: AdminDataStore, ctx: StaffContext, orderId: string, courier: string, trackingReference: string, idempotencyKey: string) {
  assertPermission(ctx, "orders.fulfil");
  return runIdempotent(store, ctx, "orders.courier", idempotencyKey, async (tx) => {
    const order = await tx.get("orders", orderId);
    if (!order) throw new AdminError("not_found", "Order not found.");
    if (["delivered", "cancelled", "returned"].includes(order.fulfilmentStatus)) throw new AdminError("precondition", "Courier details are locked once an order is closed.");
    const next = stripUndefined({ courier: courier.trim() || undefined, trackingReference: trackingReference.trim() || undefined });
    tx.update("orders", orderId, { ...next, updatedAt: nowIso() });
    recordAudit(tx, ctx, { action: "orders.courier", entityType: "order", entityId: orderId, summary: `Courier details for ${order.ref}`, before: pick(order, ["courier", "trackingReference"]), after: next });
    return { orderId };
  });
}

/* ----------------------------------------------------------- Manual sale */

export interface ManualSaleInput {
  manualChannel: ManualChannel;
  customer: { name: string; phone: string; email?: string };
  address: { region: string; city: string; addressLine: string; ghanaPostGps?: string; landmark?: string; notes?: string };
  lines: { sku: string; quantity: number }[];
  /** Delivery rate ID, or "pickup" for collection at the fulfilment origin. */
  deliveryRateId: string;
  payment: { method: NonNullable<PaymentRecord["manualMethod"]>; evidence: string; amountPesewas: number };
  idempotencyKey: string;
}

/**
 * Record an Instagram/WhatsApp/phone/walk-in order. Prices and delivery come
 * from the current catalogue and rate table, never from the form. Stock is
 * reserved through the same movement ledger as website orders. The order is
 * marked paid only once a staff member with `payments.approve_manual` approves
 * the payment evidence (immediately, if the creator has that permission).
 */
export async function createManualSale(store: AdminDataStore, ctx: StaffContext, input: ManualSaleInput) {
  assertPermission(ctx, "orders.manual_sale");
  const errors: Record<string, string> = {};
  const name = input.customer.name.trim();
  const phone = normalizeGhanaPhone(input.customer.phone);
  const email = input.customer.email?.trim().toLowerCase() || undefined;
  if (!name) errors.name = "Customer name is required.";
  if (!phone) errors.phone = "Enter a Ghana phone number (0XXXXXXXXX or +233…).";
  if (email && !isValidEmail(email)) errors.email = "This email looks invalid.";
  if (!isGhanaRegion(input.address.region)) errors.region = "Choose a region.";
  if (!input.address.city.trim()) errors.city = "City or town is required.";
  if (input.deliveryRateId !== "pickup" && !input.address.addressLine.trim()) errors.addressLine = "Address or landmark is required for delivery.";
  const lines = input.lines.filter((line) => line.sku && line.quantity > 0);
  if (!lines.length) errors.lines = "Add at least one book.";
  if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity > 50)) errors.lines = "Quantities must be whole numbers up to 50.";
  if (new Set(lines.map((line) => line.sku)).size !== lines.length) errors.lines = "List each SKU once.";
  if (input.payment.evidence.trim().length < 4) errors.evidence = "Record the payment evidence (MoMo transaction ID, bank ref, receipt no.).";
  if (!Number.isSafeInteger(input.payment.amountPesewas) || input.payment.amountPesewas <= 0) errors.amount = "Enter the amount received.";
  if (Object.keys(errors).length) throw new AdminError("invalid", "Please fix the highlighted fields.", errors);

  const approveNow = can(ctx, "payments.approve_manual");

  return runIdempotent(store, ctx, "orders.manualSale", input.idempotencyKey, async (tx) => {
    const snapshots: OrderLineSnapshot[] = [];
    const records = new Map<string, InventoryRecord>();
    let weight = 0;
    for (const line of lines) {
      const variant = await tx.get("bookVariants", line.sku);
      if (!variant || !variant.active) throw new AdminError("precondition", `${line.sku} is not an active variant.`);
      const book = await tx.get("books", variant.bookId);
      if (!book || book.status === "archived") throw new AdminError("precondition", `${line.sku} belongs to an archived or missing book.`);
      const record = await tx.get("inventory", line.sku);
      if (!record || record.onHand - record.reserved < line.quantity) {
        throw new AdminError("precondition", `Only ${record ? Math.max(0, record.onHand - record.reserved) : 0} × ${line.sku} available.`);
      }
      records.set(line.sku, record);
      weight += variant.weightGrams * line.quantity;
      snapshots.push(stripUndefined({ sku: variant.sku, bookId: book.id, title: book.title, format: variant.format, isbn: variant.isbn, unitPricePesewas: variant.pricePesewas, quantity: line.quantity, lineTotalPesewas: variant.pricePesewas * line.quantity }));
    }
    const subtotal = snapshots.reduce((sum, line) => sum + line.lineTotalPesewas, 0);

    let delivery: Order["delivery"];
    if (input.deliveryRateId === "pickup") {
      delivery = { rateId: "pickup", rateVersion: 0, serviceLevel: "pickup", pricePesewas: 0, estimate: "Customer collects" };
    } else {
      const rate = await tx.get("deliveryRates", input.deliveryRateId);
      if (!rate || !rate.active) throw new AdminError("precondition", "That delivery rate is no longer active. Choose another.");
      if (rate.region !== input.address.region) throw new AdminError("invalid", "The chosen delivery rate does not cover this region.", { deliveryRateId: "Region mismatch" });
      if (weight < rate.minWeightGrams || weight > rate.maxWeightGrams) throw new AdminError("invalid", `Parcel weight ${weight} g is outside this rate's band.`, { deliveryRateId: "Weight band" });
      delivery = { rateId: rate.id, rateVersion: rate.version, serviceLevel: rate.serviceLevel, pricePesewas: rate.pricePesewas, estimate: rate.estimate };
    }
    const total = subtotal + delivery.pricePesewas;
    if (input.payment.amountPesewas !== total) {
      throw new AdminError("invalid", `Amount received must equal the order total (${total} pesewas). Adjust lines or record the correct amount.`, { amount: "Must equal total" });
    }
    const settings = await tx.get("siteSettings", "site");

    const at = nowIso();
    const orderId = newId("ord");
    const paymentId = newId("pay");
    const order: Order = stripUndefined({
      id: orderId,
      ref: newOrderRef(),
      channel: "manual",
      manualChannel: input.manualChannel,
      customer: { name, phone: phone!, email },
      address: {
        region: input.address.region,
        city: input.address.city.trim(),
        addressLine: input.address.addressLine.trim() || "Pickup",
        ghanaPostGps: input.address.ghanaPostGps?.trim() || undefined,
        landmark: input.address.landmark?.trim() || undefined,
        notes: input.address.notes?.trim() || undefined,
      },
      lines: snapshots,
      delivery,
      discountPesewas: 0,
      subtotalPesewas: subtotal,
      totalPesewas: total,
      currency: "GHS",
      paymentStatus: approveNow ? "paid" : "pending",
      paymentId,
      fulfilmentStatus: "new",
      fulfilmentHistory: [{ from: null, to: "new", actorUid: ctx.uid, actorName: ctx.name, at, note: `Manual ${input.manualChannel} sale recorded` }],
      stockState: "reserved",
      staffNotes: [],
      createdAt: at,
      paidAt: approveNow ? at : undefined,
      updatedAt: at,
      schemaVersion: SCHEMA_VERSION,
    } satisfies Order);
    const payment: PaymentRecord = stripUndefined({
      id: paymentId,
      orderId,
      provider: "manual",
      reference: input.payment.evidence.trim(),
      amountPesewas: input.payment.amountPesewas,
      currency: "GHS",
      providerStatus: approveNow ? "approved" : "awaiting_approval",
      verified: approveNow,
      manualMethod: input.payment.method,
      manualEvidence: input.payment.evidence.trim(),
      approvedBy: approveNow ? ctx.uid : undefined,
      approvedAt: approveNow ? at : undefined,
      verificationHistory: [{ at, status: approveNow ? "approved" : "recorded", source: "staff" }],
      refunds: [],
      createdAt: at,
      updatedAt: at,
    } satisfies PaymentRecord);

    if (approveNow) {
      moveOrderStock(tx, ctx, order, records, "sellDirect", "Manual sale, payment approved at entry");
      order.stockState = "sold";
    } else {
      moveOrderStock(tx, ctx, order, records, "reserve", "Manual sale reserved pending payment approval");
    }
    tx.create("orders", orderId, order);
    tx.create("payments", paymentId, payment);
    if (approveNow) enqueueOrderSms(tx, order, "order_paid", null, settings?.smsEnabled ?? false);
    recordAudit(tx, ctx, {
      action: "orders.manual_sale",
      entityType: "order",
      entityId: orderId,
      summary: `Manual ${input.manualChannel} sale ${order.ref} for ${total} pesewas (${approveNow ? "payment approved" : "awaiting payment approval"})`,
      after: { lines: snapshots.map((line) => `${line.quantity}×${line.sku}`), totalPesewas: total, paymentMethod: input.payment.method },
    });
    return { orderId, ref: order.ref, approved: approveNow };
  });
}

export async function approveManualPayment(store: AdminDataStore, ctx: StaffContext, orderId: string, idempotencyKey: string) {
  assertPermission(ctx, "payments.approve_manual");
  return runIdempotent(store, ctx, "payments.approveManual", idempotencyKey, async (tx) => {
    const order = await tx.get("orders", orderId);
    if (!order || !order.paymentId) throw new AdminError("not_found", "Order not found.");
    if (order.channel !== "manual") throw new AdminError("forbidden", "Website orders are marked paid only by Paystack verification.");
    if (order.paymentStatus !== "pending") throw new AdminError("precondition", `Payment is already ${order.paymentStatus}.`);
    if (order.fulfilmentStatus === "cancelled") throw new AdminError("precondition", "This order was cancelled.");
    const payment = await tx.get("payments", order.paymentId);
    if (!payment || payment.provider !== "manual" || !payment.manualEvidence) throw new AdminError("precondition", "No manual payment evidence is recorded.");
    if (payment.amountPesewas !== order.totalPesewas) throw new AdminError("precondition", "Recorded amount does not match the order total.");
    const records = await readOrderInventory(tx, order);
    const settings = await tx.get("siteSettings", "site");
    const slot = await readNotificationSlot(tx, order.id, "order_paid");
    const at = nowIso();
    moveOrderStock(tx, ctx, order, records, "sell", "Manual sale payment approved");
    const next: Order = { ...order, paymentStatus: "paid", paidAt: at, stockState: "sold", updatedAt: at };
    tx.set("orders", order.id, next);
    tx.update("payments", payment.id, {
      verified: true,
      providerStatus: "approved",
      approvedBy: ctx.uid,
      approvedAt: at,
      verificationHistory: [...payment.verificationHistory, { at, status: "approved", source: "staff" }],
      updatedAt: at,
    });
    enqueueOrderSms(tx, next, "order_paid", slot, settings?.smsEnabled ?? false);
    recordAudit(tx, ctx, { action: "payments.manual.approve", entityType: "order", entityId: order.id, summary: `Approved manual payment ${payment.reference} for ${order.ref}` });
    return { orderId };
  });
}

/* --------------------------------------------------------------- Refunds */

/**
 * Paystack refunds are executed by shared commerce (request R5). The admin
 * records the request; the refund gateway, once registered, submits it to
 * Paystack and the refund webhook moves it to processed. Manual-payment
 * refunds are recorded with the staff member's evidence of money returned.
 *
 * Stock is never moved by a refund itself. It returns on cancellation (if the
 * order was not dispatched) or on a `returned` transition with restock.
 */
export interface RefundGateway {
  submitPaystackRefund(payment: PaymentRecord, refund: RefundRecord): Promise<{ providerReference: string; status: "processing" | "processed" | "failed" }>;
}

let refundGateway: RefundGateway | undefined;

export function registerRefundGateway(gateway: RefundGateway): void {
  refundGateway = gateway;
}

export interface RefundInput {
  orderId: string;
  amountPesewas: number;
  reason: string;
  /** Manual payments only: MoMo/bank reference proving money was returned. */
  manualEvidence?: string;
  idempotencyKey: string;
}

export function refundedSoFar(payment: PaymentRecord): number {
  return payment.refunds.filter((refund) => refund.status !== "failed").reduce((sum, refund) => sum + refund.amountPesewas, 0);
}

export async function requestRefund(store: AdminDataStore, ctx: StaffContext, input: RefundInput) {
  assertPermission(ctx, "payments.refund");
  if (!Number.isSafeInteger(input.amountPesewas) || input.amountPesewas <= 0) throw new AdminError("invalid", "Enter a refund amount.", { amount: "Required" });
  if (input.reason.trim().length < 4) throw new AdminError("invalid", "Explain why this refund is being issued.", { reason: "Required" });

  const outcome = await runIdempotent(store, ctx, "payments.refund", input.idempotencyKey, async (tx) => {
    const order = await tx.get("orders", input.orderId);
    if (!order?.paymentId) throw new AdminError("not_found", "Order not found.");
    if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") throw new AdminError("precondition", `Cannot refund an order whose payment is ${order.paymentStatus}.`);
    const payment = await tx.get("payments", order.paymentId);
    if (!payment || !payment.verified) throw new AdminError("precondition", "There is no verified payment to refund.");
    const remaining = payment.amountPesewas - refundedSoFar(payment);
    if (input.amountPesewas > remaining) throw new AdminError("invalid", `At most ${remaining} pesewas can still be refunded.`, { amount: "Too high" });
    if (payment.provider === "manual" && (input.manualEvidence?.trim().length ?? 0) < 4) throw new AdminError("invalid", "Record the reference for the money returned to the customer.", { manualEvidence: "Required" });
    const settings = await tx.get("siteSettings", "site");
    const slot = payment.provider === "manual" ? await readNotificationSlot(tx, order.id, "refund_processed") : null;

    const at = nowIso();
    const isManual = payment.provider === "manual";
    const refund: RefundRecord = stripUndefined({
      id: newId("rfd"),
      amountPesewas: input.amountPesewas,
      reason: input.reason.trim(),
      status: isManual ? "processed" : "requested",
      providerReference: isManual ? input.manualEvidence!.trim() : undefined,
      requestedBy: ctx.uid,
      requestedAt: at,
      updatedAt: at,
    } satisfies RefundRecord);
    const fullyRefunded = refundedSoFar(payment) + input.amountPesewas >= payment.amountPesewas;
    const paymentStatus: PaymentStatus = isManual ? (fullyRefunded ? "refunded" : "partially_refunded") : "refund_pending";
    tx.update("payments", payment.id, { refunds: [...payment.refunds, refund], updatedAt: at });
    const next: Order = { ...order, paymentStatus, updatedAt: at };
    tx.set("orders", order.id, next);
    if (isManual) enqueueOrderSms(tx, next, "refund_processed", slot, settings?.smsEnabled ?? false);
    recordAudit(tx, ctx, {
      action: "payments.refund.request",
      entityType: "order",
      entityId: order.id,
      summary: `${isManual ? "Recorded manual" : "Requested Paystack"} refund of ${input.amountPesewas} pesewas on ${order.ref}`,
      reason: input.reason.trim(),
      before: { paymentStatus: order.paymentStatus },
      after: { paymentStatus },
    });
    return { orderId: order.id, paymentId: payment.id, refundId: refund.id, provider: payment.provider };
  });

  // Submit Paystack refunds only after the request is durably recorded, and only once.
  if (!outcome.replayed && outcome.result.provider === "paystack") {
    if (!refundGateway) return { ...outcome, gateway: "not_connected" as const };
    const payment = await store.get("payments", outcome.result.paymentId);
    const refund = payment?.refunds.find((item) => item.id === outcome.result.refundId);
    if (payment && refund) {
      const submitted = await refundGateway.submitPaystackRefund(payment, refund);
      await store.runTransaction(async (tx) => {
        const fresh = await tx.get("payments", payment.id);
        if (!fresh) return;
        tx.update("payments", payment.id, {
          refunds: fresh.refunds.map((item) => (item.id === refund.id ? { ...item, status: submitted.status, providerReference: submitted.providerReference, updatedAt: nowIso() } : item)),
          updatedAt: nowIso(),
        });
      });
      return { ...outcome, gateway: submitted.status };
    }
  }
  return { ...outcome, gateway: "n/a" as const };
}

/* ----------------------------------------------------------------- Reads */

export interface OrderFilter {
  payment?: PaymentStatus | "all";
  fulfilment?: FulfilmentStatus | "all" | "open";
  channel?: "website" | "manual" | "all";
  q?: string;
  region?: string;
  courier?: string;
  from?: string;
  to?: string;
  exceptions?: boolean;
}

export interface OrderListRow {
  id: string;
  ref: string;
  channel: Order["channel"];
  customerName: string;
  customerContact: string;
  region: string;
  city: string;
  itemCount: number;
  totalPesewas: number;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  courier?: string;
  hasException: boolean;
  createdAt: string;
}

const OPEN: ReadonlySet<FulfilmentStatus> = new Set(["new", "picking", "packed", "dispatched", "exception"]);

export async function listOrders(store: AdminDataStore, ctx: StaffContext, filter: OrderFilter = {}): Promise<OrderListRow[]> {
  assertPermission(ctx, "orders.view");
  const orders = await store.query("orders", { orderBy: { field: "createdAt", direction: "desc" } });
  const showContact = can(ctx, "customers.view_contact");
  const q = filter.q?.trim().toLowerCase();
  return orders
    .filter((order) => {
      if (filter.payment && filter.payment !== "all" && order.paymentStatus !== filter.payment) return false;
      if (filter.fulfilment === "open" && !OPEN.has(order.fulfilmentStatus)) return false;
      if (filter.fulfilment && filter.fulfilment !== "all" && filter.fulfilment !== "open" && order.fulfilmentStatus !== filter.fulfilment) return false;
      if (filter.channel && filter.channel !== "all" && order.channel !== filter.channel) return false;
      if (filter.region && order.address.region !== filter.region) return false;
      if (filter.courier && (order.courier ?? "").toLowerCase() !== filter.courier.toLowerCase()) return false;
      if (filter.from && order.createdAt < filter.from) return false;
      if (filter.to && order.createdAt > `${filter.to}T23:59:59.999Z`) return false;
      if (filter.exceptions && !(order.fulfilmentStatus === "exception" || (order.exception && !order.exception.resolvedAt))) return false;
      if (q) {
        const fields = [order.ref, order.customer.name, order.address.city, order.paystackReference ?? ""];
        if (showContact) fields.push(order.customer.phone, order.customer.email ?? "");
        const digits = q.replace(/\D/g, "");
        const phoneMatch = showContact && digits.length >= 6 && order.customer.phone.replace(/\D/g, "").includes(digits.replace(/^0/, ""));
        if (!phoneMatch && !fields.join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .map((order) => ({
      id: order.id,
      ref: order.ref,
      channel: order.channel,
      customerName: order.customer.name,
      customerContact: showContact ? order.customer.phone : maskPhone(order.customer.phone),
      region: order.address.region,
      city: order.address.city,
      itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
      totalPesewas: order.totalPesewas,
      paymentStatus: order.paymentStatus,
      fulfilmentStatus: order.fulfilmentStatus,
      courier: order.courier,
      hasException: order.fulfilmentStatus === "exception" || Boolean(order.exception && !order.exception.resolvedAt),
      createdAt: order.createdAt,
    }));
}

export async function getOrderDetail(store: AdminDataStore, ctx: StaffContext, orderId: string) {
  assertPermission(ctx, "orders.view");
  const order = await store.get("orders", orderId);
  if (!order) return null;
  const [payment, movements, notifications, audit] = await Promise.all([
    order.paymentId ? store.get("payments", order.paymentId) : Promise.resolve(null),
    store.query("stockMovements", { where: [["orderId", "==", orderId]], orderBy: { field: "createdAt", direction: "asc" } }),
    store.query("notifications", { where: [["orderId", "==", orderId]], orderBy: { field: "createdAt", direction: "asc" } }),
    can(ctx, "audit.view") ? store.query("auditEvents", { where: [["entityId", "==", orderId]], orderBy: { field: "at", direction: "asc" } }) : Promise.resolve([]),
  ]);
  const showContact = can(ctx, "customers.view_contact");
  const safeOrder: Order = showContact
    ? order
    : { ...order, customer: { name: order.customer.name, phone: maskPhone(order.customer.phone), email: maskEmail(order.customer.email) }, address: { ...order.address, addressLine: "•••", ghanaPostGps: order.address.ghanaPostGps ? "•••" : undefined } };
  const safePayment = payment && !can(ctx, "finance.view") && !can(ctx, "payments.refund") ? { ...payment, manualEvidence: payment.manualEvidence ? "•••" : undefined } : payment;
  return {
    order: safeOrder,
    payment: safePayment,
    movements,
    notifications: notifications.map((record) => ({ ...record, recipient: maskPhone(record.recipient) })),
    audit,
    contactVisible: showContact,
  };
}
