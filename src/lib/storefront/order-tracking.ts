import { timingSafeEqual } from "node:crypto";
import type { AdminDataStore } from "@/lib/admin/store/types";
import type { FulfilmentStatus, Order, PaymentStatus } from "@/lib/admin/types";
import { normalizeGhanaPhone } from "@/lib/admin/validation";

/**
 * Customer order tracking.
 *
 * A lookup needs both the order reference and the phone number on the order.
 * Any mismatch returns the same "not found" result so references cannot be
 * confirmed by guessing. The public view leaves out the customer's name,
 * phone, email, street address, staff names and internal notes.
 */

export interface TrackedOrder {
  ref: string;
  placedAt: string;
  paymentStatus: "awaiting_payment" | "paid" | "payment_failed" | "refunded";
  fulfilmentStatus: FulfilmentStatus;
  timeline: { status: FulfilmentStatus; at: string }[];
  items: { title: string; format: string; quantity: number }[];
  totalPesewas: number;
  destination: string;
  estimate: string;
  courier?: string;
  trackingReference?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
}

export type TrackingResult = { ok: true; order: TrackedOrder } | { ok: false; reason: "invalid" | "not_found" };

const REF_PATTERN = /^BD-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

export function normalizeOrderRef(input: string): string | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, "");
  const ref = compact.startsWith("BD-") ? compact : compact.startsWith("BD") ? `BD-${compact.slice(2)}` : `BD-${compact}`;
  return REF_PATTERN.test(ref) ? ref : null;
}

function samePhone(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function publicPaymentStatus(status: PaymentStatus): TrackedOrder["paymentStatus"] {
  if (status === "paid" || status === "refund_pending") return "paid";
  if (status === "refunded" || status === "partially_refunded") return "refunded";
  if (status === "failed" || status === "abandoned") return "payment_failed";
  return "awaiting_payment";
}

export function toTrackedOrder(order: Order): TrackedOrder {
  return {
    ref: order.ref,
    placedAt: order.createdAt,
    paymentStatus: publicPaymentStatus(order.paymentStatus),
    fulfilmentStatus: order.fulfilmentStatus,
    timeline: order.fulfilmentHistory.map((event) => ({ status: event.to, at: event.at })),
    items: order.lines.map((line) => ({ title: line.title, format: line.format, quantity: line.quantity })),
    totalPesewas: order.totalPesewas,
    destination: [order.address.city, order.address.region].filter(Boolean).join(", "),
    estimate: order.delivery.estimate,
    courier: order.courier,
    trackingReference: order.trackingReference,
    dispatchedAt: order.dispatchedAt,
    deliveredAt: order.deliveredAt,
  };
}

export async function trackOrder(store: AdminDataStore, refInput: string, phoneInput: string): Promise<TrackingResult> {
  const ref = normalizeOrderRef(refInput);
  const phone = normalizeGhanaPhone(phoneInput);
  if (!ref || !phone) return { ok: false, reason: "invalid" };
  const [order] = await store.query("orders", { where: [["ref", "==", ref]], limit: 1 });
  const orderPhone = order ? normalizeGhanaPhone(order.customer.phone) : null;
  if (!order || !orderPhone || !samePhone(orderPhone, phone)) return { ok: false, reason: "not_found" };
  return { ok: true, order: toTrackedOrder(order) };
}
