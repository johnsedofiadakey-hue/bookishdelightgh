import { stripUndefined } from "@/lib/admin/audit";
import type { StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { derivedId, newId, newOrderRef, nowIso, randomSecret } from "@/lib/admin/ids";
import { quoteDelivery } from "@/lib/admin/ops/delivery";
import { applyMovement, availableOf } from "@/lib/admin/ops/inventory";
import { enqueueOrderSms, readNotificationSlot } from "@/lib/admin/ops/notifications";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";
import { SCHEMA_VERSION, type AuditEvent, type DeliveryRate, type InventoryRecord, type MovementType, type Order, type OrderLineSnapshot, type PaymentRecord } from "@/lib/admin/types";
import { isGhanaRegion, isValidEmail, normalizeGhanaPhone } from "@/lib/admin/validation";

/**
 * Website checkout: pricing, delivery quotes, stock reservation and payment
 * confirmation. Prices, stock and delivery always come from the database,
 * never from the browser. Orders follow the admin contract in
 * ADMIN_INTEGRATION_NOTES.md §R3:
 *
 *   create   → paymentStatus "pending", stock ORDER_RESERVED, reservation expiry
 *   verified → paymentStatus "paid", stock ORDER_SOLD, `order_paid` SMS queued
 *   failed / expired → stock ORDER_RELEASED, order cancelled
 *
 * Only Paystack verification (verify API or signed webhook) marks an order paid.
 */

export const RESERVATION_MINUTES = 30;
const MAX_LINES = 40;
const MAX_QUANTITY = 50;

/** The actor recorded on stock movements and audit events made by checkout. */
export const CHECKOUT_ACTOR: StaffContext = { uid: "system:checkout", name: "Website checkout", email: "", role: "viewer", sessionId: "", requestId: "" };

function systemAudit(tx: AdminTransaction, entry: Pick<AuditEvent, "action" | "entityId" | "summary"> & Partial<Pick<AuditEvent, "after">>) {
  const event: AuditEvent = stripUndefined({
    id: newId("aud"),
    actorUid: CHECKOUT_ACTOR.uid,
    actorName: CHECKOUT_ACTOR.name,
    actorRole: "system",
    requestId: newId("req"),
    at: nowIso(),
    entityType: "order",
    ...entry,
  });
  tx.create("auditEvents", event.id, event);
}

export interface CartLineInput {
  sku: string;
  quantity: number;
}

export interface PricedLine extends OrderLineSnapshot {
  available: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalPesewas: number;
  weightGrams: number;
  /** Lines that cannot be bought as requested. */
  problems: string[];
}

export function cleanCartLines(input: unknown): CartLineInput[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const line of input.slice(0, MAX_LINES)) {
    if (!line || typeof line.sku !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(line.sku)) continue;
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    merged.set(line.sku, Math.min((merged.get(line.sku) ?? 0) + quantity, MAX_QUANTITY));
  }
  return [...merged].map(([sku, quantity]) => ({ sku, quantity }));
}

type Reader = Pick<AdminTransaction, "get">;

/** Price a cart from the catalogue. Usable inside or outside a transaction. */
export async function priceCart(reader: Reader, lines: CartLineInput[]): Promise<PricedCart & { inventory: Map<string, InventoryRecord> }> {
  const priced: PricedLine[] = [];
  const problems: string[] = [];
  const inventory = new Map<string, InventoryRecord>();
  let weight = 0;
  for (const line of lines) {
    const variant = await reader.get("bookVariants", line.sku);
    const book = variant ? await reader.get("books", variant.bookId) : null;
    const record = variant ? await reader.get("inventory", line.sku) : null;
    if (!variant || !variant.active || !book || book.status !== "published" || variant.pricePesewas <= 0) {
      problems.push(`An item in your bag (${line.sku}) is no longer available.`);
      continue;
    }
    const available = record ? Math.max(0, availableOf(record)) : 0;
    if (record) inventory.set(line.sku, record);
    if (available < line.quantity) {
      problems.push(available ? `Only ${available} × ${book.title} (${variant.format}) left.` : `${book.title} (${variant.format}) is out of stock.`);
    }
    weight += variant.weightGrams * line.quantity;
    priced.push(stripUndefined({
      sku: variant.sku,
      bookId: book.id,
      title: book.title,
      format: variant.format,
      isbn: variant.isbn,
      unitPricePesewas: variant.pricePesewas,
      quantity: line.quantity,
      lineTotalPesewas: variant.pricePesewas * line.quantity,
      available,
    }));
  }
  if (!priced.length && !problems.length) problems.push("Your bag is empty.");
  return { lines: priced, subtotalPesewas: priced.reduce((sum, line) => sum + line.lineTotalPesewas, 0), weightGrams: weight, problems, inventory };
}

export interface DeliveryOption {
  rateId: string;
  label: string;
  serviceLevel: DeliveryRate["serviceLevel"];
  pricePesewas: number;
  estimate: string;
}

function optionFor(rate: DeliveryRate): DeliveryOption {
  const label = rate.serviceLevel === "express" ? "Express delivery" : rate.serviceLevel === "pickup" ? "Collect" : "Standard delivery";
  return { rateId: rate.id, label, serviceLevel: rate.serviceLevel, pricePesewas: rate.pricePesewas, estimate: rate.estimate };
}

export interface CheckoutQuote {
  cart: PricedCart;
  options: DeliveryOption[];
}

export async function quoteCheckout(store: AdminDataStore, input: { lines: unknown; region: string; city: string }): Promise<CheckoutQuote> {
  const lines = cleanCartLines(input.lines);
  const { inventory: _inventory, ...cart } = await priceCart(store, lines);
  if (!isGhanaRegion(input.region) || !input.city.trim()) return { cart, options: [] };
  const rates = await store.query("deliveryRates", { where: [["active", "==", true]] });
  const options = quoteDelivery(rates, { region: input.region, city: input.city, weightGrams: cart.weightGrams, orderPesewas: cart.subtotalPesewas }).map(optionFor);
  return { cart, options };
}

export interface CheckoutInput {
  lines: unknown;
  customer: { name: string; phone: string; email?: string };
  address: { region: string; city: string; addressLine: string; ghanaPostGps?: string; landmark?: string; notes?: string };
  deliveryRateId: string;
  /** What the customer was shown; payment is refused if the server total differs. */
  expectedTotalPesewas: number;
}

export interface PendingOrder {
  orderId: string;
  ref: string;
  paystackReference: string;
  totalPesewas: number;
  email: string;
}

function validateCheckout(input: CheckoutInput) {
  const errors: Record<string, string> = {};
  const name = input.customer.name.trim().slice(0, 120);
  const phone = normalizeGhanaPhone(input.customer.phone);
  const email = input.customer.email?.trim().toLowerCase().slice(0, 200) || undefined;
  if (name.length < 2) errors.name = "Enter your name.";
  if (!phone) errors.phone = "Enter a Ghana phone number, e.g. 024 000 0000.";
  if (email && !isValidEmail(email)) errors.email = "This email address looks wrong.";
  if (!isGhanaRegion(input.address.region)) errors.region = "Choose your region.";
  if (!input.address.city.trim()) errors.city = "Enter your city or town.";
  if (input.address.addressLine.trim().length < 3) errors.addressLine = "Enter your address or a landmark.";
  if (!input.deliveryRateId) errors.delivery = "Choose a delivery option.";
  if (Object.keys(errors).length) throw new AdminError("invalid", "Please check the highlighted details.", errors);
  return { name, phone: phone!, email };
}

/** Paystack-safe reference: letters, digits and hyphens only. */
function paystackReferenceFor(ref: string): string {
  return `${ref}-${randomSecret(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "X"}`;
}

/**
 * Create the website order and reserve its stock in one transaction.
 * Payment is not started here; see `startPaystackCheckout` in the server action.
 */
export async function createPendingOrder(store: AdminDataStore, input: CheckoutInput): Promise<PendingOrder> {
  const { name, phone, email } = validateCheckout(input);
  const lines = cleanCartLines(input.lines);
  if (!lines.length) throw new AdminError("invalid", "Your bag is empty.");

  return store.runTransaction(async (tx) => {
    const settings = await tx.get("siteSettings", "site");
    if (!settings?.checkoutEnabled) throw new AdminError("precondition", "Online checkout is closed right now. Please message us on WhatsApp to order.");
    const cart = await priceCart(tx, lines);
    if (cart.problems.length) throw new AdminError("conflict", cart.problems.join(" "));
    const rate = await tx.get("deliveryRates", input.deliveryRateId);
    const live = rate ? quoteDelivery([rate], { region: input.address.region, city: input.address.city, weightGrams: cart.weightGrams, orderPesewas: cart.subtotalPesewas }) : [];
    if (!rate || !live.length) throw new AdminError("conflict", "That delivery option is no longer available for your address. Please choose again.");
    const total = cart.subtotalPesewas + rate.pricePesewas;
    if (total !== input.expectedTotalPesewas) throw new AdminError("conflict", "Prices or delivery changed while you were checking out. Please review the new total.");

    const at = nowIso();
    const orderId = newId("ord");
    const paymentId = newId("pay");
    const ref = newOrderRef();
    const paystackReference = paystackReferenceFor(ref);
    const order: Order = stripUndefined({
      id: orderId,
      ref,
      channel: "website",
      customer: { name, phone, email },
      address: {
        region: input.address.region,
        city: input.address.city.trim().slice(0, 120),
        addressLine: input.address.addressLine.trim().slice(0, 300),
        ghanaPostGps: input.address.ghanaPostGps?.trim().toUpperCase().slice(0, 20) || undefined,
        landmark: input.address.landmark?.trim().slice(0, 200) || undefined,
        notes: input.address.notes?.trim().slice(0, 500) || undefined,
      },
      lines: cart.lines.map(({ available: _available, ...line }) => line),
      delivery: { rateId: rate.id, rateVersion: rate.version, serviceLevel: rate.serviceLevel, pricePesewas: rate.pricePesewas, estimate: rate.estimate },
      discountPesewas: 0,
      subtotalPesewas: cart.subtotalPesewas,
      totalPesewas: total,
      currency: "GHS",
      paymentStatus: "pending",
      paymentId,
      paystackReference,
      fulfilmentStatus: "new",
      fulfilmentHistory: [{ from: null, to: "new", actorUid: CHECKOUT_ACTOR.uid, actorName: CHECKOUT_ACTOR.name, at, note: "Website order awaiting payment" }],
      stockState: "reserved",
      reservationExpiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString(),
      staffNotes: [],
      createdAt: at,
      updatedAt: at,
      schemaVersion: SCHEMA_VERSION,
    } satisfies Order);
    const payment: PaymentRecord = {
      id: paymentId,
      orderId,
      provider: "paystack",
      reference: paystackReference,
      amountPesewas: total,
      currency: "GHS",
      providerStatus: "initialized",
      verified: false,
      verificationHistory: [],
      refunds: [],
      createdAt: at,
      updatedAt: at,
    };
    moveStock(tx, order, cart.inventory, "ORDER_RESERVED", "Website order reserved pending payment");
    tx.create("orders", orderId, order);
    tx.create("payments", paymentId, payment);
    systemAudit(tx, { action: "orders.website.created", entityId: orderId, summary: `Website order ${ref} created for ${total} pesewas, awaiting payment` });
    return { orderId, ref, paystackReference, totalPesewas: total, email: email ?? `order-${ref.toLowerCase()}@bookishdelightgh.com` };
  });
}

function moveStock(tx: AdminTransaction, order: Order, records: Map<string, InventoryRecord>, type: Extract<MovementType, "ORDER_RESERVED" | "ORDER_RELEASED" | "ORDER_SOLD">, reason: string, round = "") {
  order.lines.forEach((line, index) => {
    const record = records.get(line.sku);
    if (!record) throw new AdminError("not_found", `Inventory for ${line.sku} is missing.`);
    const deltas = {
      ORDER_RESERVED: { onHandDelta: 0, reservedDelta: line.quantity },
      ORDER_RELEASED: { onHandDelta: 0, reservedDelta: -line.quantity },
      ORDER_SOLD: { onHandDelta: -line.quantity, reservedDelta: -line.quantity },
    }[type];
    const movementId = derivedId("mov", "order", order.id, type, line.sku, String(index), round);
    records.set(line.sku, applyMovement(tx, CHECKOUT_ACTOR, record, { sku: line.sku, type, ...deltas, reason, reference: order.ref, orderId: order.id }, movementId));
  });
}

async function readInventory(tx: AdminTransaction, order: Order): Promise<Map<string, InventoryRecord>> {
  const records = new Map<string, InventoryRecord>();
  for (const line of order.lines) {
    if (records.has(line.sku)) continue;
    const record = await tx.get("inventory", line.sku);
    if (record) records.set(line.sku, record);
  }
  return records;
}

export interface PaystackOutcome {
  reference: string;
  status: string;
  amountPesewas: number;
  currency: string;
  paidAt?: string;
  channel?: string;
}

export type ConfirmResult =
  | { state: "paid"; orderId: string; ref: string; alreadyProcessed: boolean }
  | { state: "failed" | "pending"; orderId: string; ref: string }
  | { state: "unknown" };

/**
 * Apply a Paystack verification result. Idempotent: callback, webhook and the
 * expiry sweep can all report the same payment safely.
 */
export async function applyPaystackOutcome(store: AdminDataStore, outcome: PaystackOutcome, source: "callback" | "webhook" | "verify_api"): Promise<ConfirmResult> {
  return store.runTransaction(async (tx) => {
    const [order] = await tx.query("orders", { where: [["paystackReference", "==", outcome.reference]], limit: 1 });
    if (!order || order.channel !== "website" || !order.paymentId) return { state: "unknown" as const };
    const payment = await tx.get("payments", order.paymentId);
    if (!payment) return { state: "unknown" as const };
    const at = nowIso();
    const history = [...payment.verificationHistory, { at, status: outcome.status, source }];

    if (order.paymentStatus === "paid" || order.paymentStatus === "refund_pending" || order.paymentStatus === "refunded" || order.paymentStatus === "partially_refunded") {
      return { state: "paid" as const, orderId: order.id, ref: order.ref, alreadyProcessed: true };
    }

    if (outcome.status === "success") {
      const amountOk = outcome.amountPesewas === order.totalPesewas && outcome.currency === "GHS";
      const records = await readInventory(tx, order);
      const settings = await tx.get("siteSettings", "site");
      const slot = await readNotificationSlot(tx, order.id, "order_paid");
      const next: Order = { ...order, paymentStatus: "paid", paidAt: outcome.paidAt ?? at, updatedAt: at };
      delete next.reservationExpiresAt;

      if (!amountOk) {
        next.exception = { kind: "payment_mismatch", detail: `Paystack reported ${outcome.amountPesewas} ${outcome.currency}; order total is ${order.totalPesewas} GHS.`, raisedAt: at };
        next.fulfilmentStatus = "exception";
        next.fulfilmentHistory = [...order.fulfilmentHistory, { from: order.fulfilmentStatus, to: "exception", actorUid: CHECKOUT_ACTOR.uid, actorName: CHECKOUT_ACTOR.name, at, note: "Payment amount mismatch" }];
      } else if (order.stockState === "reserved") {
        moveStock(tx, next, records, "ORDER_SOLD", "Website payment verified");
        next.stockState = "sold";
      } else {
        // The reservation expired before payment arrived: sell if stock is still there.
        const short = order.lines.some((line) => !records.has(line.sku) || availableOf(records.get(line.sku)!) < line.quantity);
        if (short) {
          next.exception = { kind: "late_payment_no_stock", detail: "Payment arrived after the reservation expired and stock is no longer available. Refund or source the items.", raisedAt: at };
          next.fulfilmentStatus = "exception";
          next.fulfilmentHistory = [...order.fulfilmentHistory, { from: order.fulfilmentStatus, to: "exception", actorUid: CHECKOUT_ACTOR.uid, actorName: CHECKOUT_ACTOR.name, at, note: "Late payment, stock unavailable" }];
        } else {
          moveStock(tx, next, records, "ORDER_RESERVED", "Late payment: re-reserving released stock", "late");
          moveStock(tx, next, records, "ORDER_SOLD", "Website payment verified after reservation expiry", "late");
          next.stockState = "sold";
          if (order.fulfilmentStatus === "cancelled") {
            next.fulfilmentStatus = "new";
            next.fulfilmentHistory = [...order.fulfilmentHistory, { from: "cancelled", to: "new", actorUid: CHECKOUT_ACTOR.uid, actorName: CHECKOUT_ACTOR.name, at, note: "Reopened: payment arrived after expiry" }];
          }
        }
      }
      tx.set("orders", order.id, stripUndefined(next));
      tx.update("payments", payment.id, { verified: true, providerStatus: "success", verificationHistory: history, updatedAt: at });
      enqueueOrderSms(tx, next, "order_paid", slot, settings?.smsEnabled ?? false);
      systemAudit(tx, { action: "orders.website.paid", entityId: order.id, summary: `Paystack payment verified for ${order.ref} (${source})${next.exception && !next.exception.resolvedAt && next.fulfilmentStatus === "exception" ? `; exception: ${next.exception.kind}` : ""}`, after: { channel: outcome.channel, amountPesewas: outcome.amountPesewas } });
      return { state: "paid" as const, orderId: order.id, ref: order.ref, alreadyProcessed: false };
    }

    if (outcome.status === "failed" || outcome.status === "reversed") {
      if (order.paymentStatus === "failed") return { state: "failed" as const, orderId: order.id, ref: order.ref };
      const records = order.stockState === "reserved" ? await readInventory(tx, order) : null;
      const next: Order = { ...order, paymentStatus: "failed", updatedAt: at };
      delete next.reservationExpiresAt;
      if (records) {
        moveStock(tx, next, records, "ORDER_RELEASED", "Website payment failed");
        next.stockState = "released";
      }
      if (order.fulfilmentStatus === "new") {
        next.fulfilmentStatus = "cancelled";
        next.fulfilmentHistory = [...order.fulfilmentHistory, { from: "new", to: "cancelled", actorUid: CHECKOUT_ACTOR.uid, actorName: CHECKOUT_ACTOR.name, at, note: "Payment failed" }];
      }
      tx.set("orders", order.id, stripUndefined(next));
      tx.update("payments", payment.id, { providerStatus: outcome.status, verificationHistory: history, updatedAt: at });
      systemAudit(tx, { action: "orders.website.payment_failed", entityId: order.id, summary: `Paystack payment ${outcome.status} for ${order.ref}` });
      return { state: "failed" as const, orderId: order.id, ref: order.ref };
    }

    tx.update("payments", payment.id, { providerStatus: outcome.status, verificationHistory: history.slice(-20), updatedAt: at });
    return { state: "pending" as const, orderId: order.id, ref: order.ref };
  });
}

/** Release stock held by unpaid website orders whose reservation has expired. */
export async function releaseExpiredOrder(store: AdminDataStore, orderId: string): Promise<boolean> {
  return store.runTransaction(async (tx) => {
    const order = await tx.get("orders", orderId);
    if (!order || order.channel !== "website" || order.paymentStatus !== "pending" || order.stockState !== "reserved") return false;
    if (!order.reservationExpiresAt || order.reservationExpiresAt > nowIso()) return false;
    const records = await readInventory(tx, order);
    const payment = order.paymentId ? await tx.get("payments", order.paymentId) : null;
    const at = nowIso();
    const next: Order = { ...order, paymentStatus: "abandoned", stockState: "released", updatedAt: at };
    delete next.reservationExpiresAt;
    moveStock(tx, next, records, "ORDER_RELEASED", "Website order not paid in time");
    if (order.fulfilmentStatus === "new") {
      next.fulfilmentStatus = "cancelled";
      next.fulfilmentHistory = [...order.fulfilmentHistory, { from: "new", to: "cancelled", actorUid: CHECKOUT_ACTOR.uid, actorName: CHECKOUT_ACTOR.name, at, note: `Not paid within ${RESERVATION_MINUTES} minutes` }];
    }
    tx.set("orders", order.id, stripUndefined(next));
    if (payment) tx.update("payments", payment.id, { providerStatus: "abandoned", updatedAt: at });
    systemAudit(tx, { action: "orders.website.expired", entityId: order.id, summary: `Reservation for ${order.ref} expired unpaid; stock released` });
    return true;
  });
}

export async function expiredPendingOrders(store: AdminDataStore, limit = 20): Promise<Order[]> {
  const now = nowIso();
  const pending = await store.query("orders", { where: [["paymentStatus", "==", "pending"]] });
  return pending.filter((order) => order.channel === "website" && order.stockState === "reserved" && order.reservationExpiresAt && order.reservationExpiresAt <= now).slice(0, limit);
}

/** Admin-side: cancel a just-created order whose payment could not be started. */
export async function cancelUnstartedOrder(store: AdminDataStore, orderId: string, reason: string): Promise<void> {
  await store.runTransaction(async (tx) => {
    const order = await tx.get("orders", orderId);
    if (!order || order.paymentStatus !== "pending" || order.stockState !== "reserved") return;
    const records = await readInventory(tx, order);
    const at = nowIso();
    const next: Order = { ...order, paymentStatus: "failed", stockState: "released", fulfilmentStatus: "cancelled", fulfilmentHistory: [...order.fulfilmentHistory, { from: order.fulfilmentStatus, to: "cancelled", actorUid: CHECKOUT_ACTOR.uid, actorName: CHECKOUT_ACTOR.name, at, note: reason.slice(0, 200) }], updatedAt: at };
    delete next.reservationExpiresAt;
    moveStock(tx, next, records, "ORDER_RELEASED", "Payment could not be started");
    tx.set("orders", order.id, stripUndefined(next));
    systemAudit(tx, { action: "orders.website.payment_not_started", entityId: order.id, summary: `${order.ref} cancelled: ${reason.slice(0, 120)}` });
  });
}
