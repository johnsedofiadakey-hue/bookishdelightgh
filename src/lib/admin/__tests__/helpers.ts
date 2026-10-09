import { randomUUID } from "node:crypto";
import type { StaffContext } from "@/lib/admin/context";
import { DEFAULT_SETTINGS } from "@/lib/admin/ops/content";
import { MemoryAdminStore } from "@/lib/admin/store/memory";
import { SCHEMA_VERSION, type Order, type PaymentRecord, type StaffRole } from "@/lib/admin/types";

export function key(): string {
  return randomUUID();
}

export function ctxFor(role: StaffRole, uid = `test-${role}`): StaffContext {
  return { uid, name: `Test ${role}`, email: `${uid}@test.local`, role, sessionId: "ses_test", requestId: `req_${randomUUID()}` };
}

export function freshStore(): MemoryAdminStore {
  const store = new MemoryAdminStore();
  const at = new Date().toISOString();
  store.seed("siteSettings", "site", { ...DEFAULT_SETTINGS, smsEnabled: true, updatedAt: at, updatedBy: "test" });
  store.seed("categories", "fiction", { id: "fiction", slug: "fiction", name: "Fiction", order: 1, published: true, updatedAt: at });
  for (const role of ["owner", "manager", "catalogue_editor", "fulfilment", "support", "viewer"] as StaffRole[]) {
    store.seed("adminProfiles", `test-${role}`, {
      uid: `test-${role}`,
      email: `test-${role}@test.local`,
      displayName: `Test ${role}`,
      role,
      status: "active",
      sessionsValidAfter: "2000-01-01T00:00:00.000Z",
      createdAt: at,
      createdBy: "test",
      updatedAt: at,
      schemaVersion: SCHEMA_VERSION,
    });
  }
  return store;
}

/** Seed a website order exactly as shared commerce would leave it after checkout. */
export function seedWebsiteOrder(store: MemoryAdminStore, options: { id: string; sku: string; bookId: string; quantity: number; unitPricePesewas: number; paid: boolean; deliveryPesewas?: number }) {
  const at = new Date().toISOString();
  const delivery = options.deliveryPesewas ?? 2500;
  const subtotal = options.unitPricePesewas * options.quantity;
  const order: Order = {
    id: options.id,
    ref: `BD-${options.id.toUpperCase().slice(-6)}`,
    channel: "website",
    customer: { name: "Test Customer", phone: "+233200000099", email: "customer@test.local" },
    address: { region: "Greater Accra", city: "Accra", addressLine: "Test address" },
    lines: [{ sku: options.sku, bookId: options.bookId, title: "Test Book", format: "Paperback", unitPricePesewas: options.unitPricePesewas, quantity: options.quantity, lineTotalPesewas: subtotal }],
    delivery: { rateId: "rate_x", rateVersion: 1, serviceLevel: "standard", pricePesewas: delivery, estimate: "1–2 days" },
    discountPesewas: 0,
    subtotalPesewas: subtotal,
    totalPesewas: subtotal + delivery,
    currency: "GHS",
    paymentStatus: options.paid ? "paid" : "pending",
    paymentId: `pay_${options.id}`,
    paystackReference: `PSK-${options.id}`,
    fulfilmentStatus: "new",
    fulfilmentHistory: [{ from: null, to: "new", actorUid: "system", actorName: "Checkout", at }],
    stockState: options.paid ? "sold" : "reserved",
    staffNotes: [],
    createdAt: at,
    ...(options.paid ? { paidAt: at } : {}),
    updatedAt: at,
    schemaVersion: SCHEMA_VERSION,
  };
  const payment: PaymentRecord = {
    id: order.paymentId!,
    orderId: order.id,
    provider: "paystack",
    reference: order.paystackReference!,
    amountPesewas: order.totalPesewas,
    currency: "GHS",
    providerStatus: options.paid ? "success" : "pending",
    verified: options.paid,
    verificationHistory: [],
    refunds: [],
    createdAt: at,
    updatedAt: at,
  };
  store.seed("orders", order.id, order);
  store.seed("payments", payment.id, payment);
  return order;
}
