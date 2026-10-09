import { assertPermission, can, type StaffContext } from "@/lib/admin/context";
import { dayKey, maskEmail, maskPhone } from "@/lib/admin/format";
import { availableOf, stockState } from "@/lib/admin/ops/inventory";
import { refundedSoFar } from "@/lib/admin/ops/orders";
import type { AdminDataStore } from "@/lib/admin/store/types";
import type { AuditEvent, MovementType, Order, PaymentRecord } from "@/lib/admin/types";

/**
 * Reporting rules (shown on the reports screen):
 * - Revenue counts only orders with verified payment (`paidAt` set and
 *   payment status paid / refund_pending / partially_refunded / refunded).
 *   Pending, failed, abandoned and never-paid cancelled orders are excluded.
 * - The date window is applied to `paidAt` (Africa/Accra = UTC).
 * - Gross = sum of order totals; refunds = processed refunds on those orders;
 *   net = gross − refunds. Everything is summed in integer pesewas.
 */

const REVENUE_STATUSES = new Set(["paid", "refund_pending", "partially_refunded", "refunded"]);

export function isRevenueOrder(order: Order): boolean {
  return Boolean(order.paidAt) && REVENUE_STATUSES.has(order.paymentStatus);
}

export interface DateWindow {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export function defaultWindow(days = 30): DateWindow {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function inWindow(iso: string | undefined, window: DateWindow): boolean {
  if (!iso) return false;
  const key = dayKey(iso);
  return key >= window.from && key <= window.to;
}

function processedRefunds(payment: PaymentRecord | undefined): number {
  if (!payment) return 0;
  return payment.refunds.filter((refund) => refund.status === "processed").reduce((sum, refund) => sum + refund.amountPesewas, 0);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export async function salesReport(store: AdminDataStore, ctx: StaffContext, window: DateWindow) {
  assertPermission(ctx, "reports.view");
  const [orders, payments, books, categories] = await Promise.all([store.query("orders"), store.query("payments"), store.query("books"), store.query("categories")]);
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const bookById = new Map(books.map((book) => [book.id, book]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const revenueOrders = orders.filter((order) => isRevenueOrder(order) && inWindow(order.paidAt, window));
  const excluded = orders.filter((order) => inWindow(order.createdAt, window) && !isRevenueOrder(order));

  let gross = 0;
  let refunds = 0;
  let delivery = 0;
  let discounts = 0;
  const byDay = new Map<string, { orders: number; grossPesewas: number }>();
  const byVariant = new Map<string, { sku: string; title: string; format: string; units: number; grossPesewas: number }>();
  const byCategory = new Map<string, { name: string; units: number; grossPesewas: number }>();
  const byRegion = new Map<string, { orders: number; grossPesewas: number; deliveryPesewas: number }>();
  const byChannel = new Map<string, { orders: number; grossPesewas: number }>();
  const dispatchHours: number[] = [];
  const deliveryHours: number[] = [];

  for (const order of revenueOrders) {
    gross += order.totalPesewas;
    delivery += order.delivery.pricePesewas;
    discounts += order.discountPesewas;
    refunds += processedRefunds(order.paymentId ? paymentById.get(order.paymentId) : undefined);
    const day = byDay.get(dayKey(order.paidAt!)) ?? { orders: 0, grossPesewas: 0 };
    day.orders += 1;
    day.grossPesewas += order.totalPesewas;
    byDay.set(dayKey(order.paidAt!), day);
    const region = byRegion.get(order.address.region) ?? { orders: 0, grossPesewas: 0, deliveryPesewas: 0 };
    region.orders += 1;
    region.grossPesewas += order.totalPesewas;
    region.deliveryPesewas += order.delivery.pricePesewas;
    byRegion.set(order.address.region, region);
    const channel = byChannel.get(order.channel) ?? { orders: 0, grossPesewas: 0 };
    channel.orders += 1;
    channel.grossPesewas += order.totalPesewas;
    byChannel.set(order.channel, channel);
    for (const line of order.lines) {
      const variant = byVariant.get(line.sku) ?? { sku: line.sku, title: line.title, format: line.format, units: 0, grossPesewas: 0 };
      variant.units += line.quantity;
      variant.grossPesewas += line.lineTotalPesewas;
      byVariant.set(line.sku, variant);
      for (const categoryId of bookById.get(line.bookId)?.categoryIds ?? ["uncategorised"]) {
        const category = byCategory.get(categoryId) ?? { name: categoryName.get(categoryId) ?? categoryId, units: 0, grossPesewas: 0 };
        category.units += line.quantity;
        category.grossPesewas += line.lineTotalPesewas;
        byCategory.set(categoryId, category);
      }
    }
    if (order.dispatchedAt) dispatchHours.push(Math.round((Date.parse(order.dispatchedAt) - Date.parse(order.paidAt!)) / 3_600_000));
    if (order.deliveredAt) deliveryHours.push(Math.round((Date.parse(order.deliveredAt) - Date.parse(order.paidAt!)) / 3_600_000));
  }

  const days: { day: string; orders: number; grossPesewas: number }[] = [];
  for (let cursor = Date.parse(`${window.from}T00:00:00Z`); cursor <= Date.parse(`${window.to}T00:00:00Z`); cursor += 86_400_000) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    days.push({ day: key, ...(byDay.get(key) ?? { orders: 0, grossPesewas: 0 }) });
  }

  return {
    window,
    totals: { orders: revenueOrders.length, grossPesewas: gross, refundsPesewas: refunds, netPesewas: gross - refunds, deliveryPesewas: delivery, discountsPesewas: discounts },
    excluded: { count: excluded.length, byStatus: countBy(excluded.map((order) => order.paymentStatus)) },
    days,
    byVariant: [...byVariant.values()].sort((left, right) => right.grossPesewas - left.grossPesewas),
    byCategory: [...byCategory.values()].sort((left, right) => right.grossPesewas - left.grossPesewas),
    byRegion: [...byRegion.entries()].map(([region, value]) => ({ region, ...value })).sort((left, right) => right.orders - left.orders),
    byChannel: [...byChannel.entries()].map(([channel, value]) => ({ channel, ...value })),
    fulfilment: { medianHoursToDispatch: median(dispatchHours), medianHoursToDelivery: median(deliveryHours), dispatched: dispatchHours.length, delivered: deliveryHours.length },
  };
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

export async function paymentsReport(store: AdminDataStore, ctx: StaffContext, window: DateWindow) {
  assertPermission(ctx, "reports.view");
  const payments = await store.query("payments");
  const inRange = payments.filter((payment) => inWindow(payment.createdAt, window));
  const refunds = payments.flatMap((payment) => payment.refunds.filter((refund) => inWindow(refund.requestedAt, window)).map((refund) => ({ ...refund, orderId: payment.orderId, provider: payment.provider })));
  return {
    payments: inRange.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      reference: payment.reference,
      amountPesewas: payment.amountPesewas,
      providerStatus: payment.providerStatus,
      verified: payment.verified,
      refundedPesewas: refundedSoFar(payment),
      createdAt: payment.createdAt,
    })),
    refunds,
  };
}

export async function stockMovementReport(store: AdminDataStore, ctx: StaffContext, window: DateWindow) {
  assertPermission(ctx, "reports.view");
  const movements = (await store.query("stockMovements", { orderBy: { field: "createdAt", direction: "desc" } })).filter((movement) => inWindow(movement.createdAt, window));
  const byType = new Map<MovementType, { count: number; onHandDelta: number }>();
  for (const movement of movements) {
    const entry = byType.get(movement.type) ?? { count: 0, onHandDelta: 0 };
    entry.count += 1;
    entry.onHandDelta += movement.onHandDelta;
    byType.set(movement.type, entry);
  }
  return { movements, byType: [...byType.entries()].map(([type, value]) => ({ type, ...value })) };
}

export async function lowStockReport(store: AdminDataStore, ctx: StaffContext) {
  assertPermission(ctx, "inventory.view");
  const [inventory, variants, books] = await Promise.all([store.query("inventory"), store.query("bookVariants"), store.query("books")]);
  const variantBySku = new Map(variants.map((variant) => [variant.sku, variant]));
  const bookById = new Map(books.map((book) => [book.id, book]));
  return inventory
    .filter((record) => variantBySku.get(record.sku)?.active && stockState(record) !== "in_stock")
    .map((record) => {
      const variant = variantBySku.get(record.sku)!;
      return {
        sku: record.sku,
        title: bookById.get(variant.bookId)?.title ?? "(missing book)",
        format: variant.format,
        onHand: record.onHand,
        reserved: record.reserved,
        available: availableOf(record),
        threshold: record.lowStockThreshold,
        state: stockState(record),
        published: bookById.get(variant.bookId)?.status === "published",
      };
    })
    .sort((left, right) => left.available - right.available);
}

/* -------------------------------------------------------------- Customers */

export interface CustomerRow {
  key: string;
  name: string;
  phone: string;
  email: string;
  orders: number;
  paidOrders: number;
  lifetimePesewas: number;
  lastOrderAt: string;
  lastOrderRef: string;
  lastOrderId: string;
  regions: string[];
}

/** Order-derived support view: there is no separate customer collection. */
export async function listCustomers(store: AdminDataStore, ctx: StaffContext, q?: string): Promise<CustomerRow[]> {
  assertPermission(ctx, "customers.view");
  const showContact = can(ctx, "customers.view_contact");
  const orders = await store.query("orders", { orderBy: { field: "createdAt", direction: "desc" } });
  const byKey = new Map<string, CustomerRow>();
  for (const order of orders) {
    const key = order.customer.phone.replace(/\D/g, "");
    const row = byKey.get(key) ?? {
      key,
      name: order.customer.name,
      phone: showContact ? order.customer.phone : maskPhone(order.customer.phone),
      email: showContact ? order.customer.email ?? "—" : maskEmail(order.customer.email),
      orders: 0,
      paidOrders: 0,
      lifetimePesewas: 0,
      lastOrderAt: order.createdAt,
      lastOrderRef: order.ref,
      lastOrderId: order.id,
      regions: [],
    };
    row.orders += 1;
    if (isRevenueOrder(order)) {
      row.paidOrders += 1;
      row.lifetimePesewas += order.totalPesewas;
    }
    if (!row.regions.includes(order.address.region)) row.regions.push(order.address.region);
    byKey.set(key, row);
  }
  const needle = q?.trim().toLowerCase();
  if (!needle) return [...byKey.values()];
  const digits = needle.replace(/\D/g, "").replace(/^0/, "");
  return [...byKey.values()].filter((row) => {
    const orderRefs = orders.filter((order) => order.customer.phone.replace(/\D/g, "") === row.key).map((order) => order.ref.toLowerCase());
    if (orderRefs.some((ref) => ref.includes(needle))) return true;
    if (row.name.toLowerCase().includes(needle)) return true;
    if (!showContact) return false;
    if (digits.length >= 6 && row.key.includes(digits)) return true;
    return row.email.toLowerCase().includes(needle);
  });
}

/* -------------------------------------------------------------- Dashboard */

export async function dashboardSummary(store: AdminDataStore, ctx: StaffContext) {
  assertPermission(ctx, "dashboard.view");
  const [orders, inventory, variants, notifications, books] = await Promise.all([
    store.query("orders", { orderBy: { field: "createdAt", direction: "desc" } }),
    store.query("inventory"),
    store.query("bookVariants"),
    store.query("notifications"),
    store.query("books"),
  ]);
  const activeSkus = new Set(variants.filter((variant) => variant.active).map((variant) => variant.sku));
  const tracked = inventory.filter((record) => activeSkus.has(record.sku));
  const window = defaultWindow(30);
  const revenue = orders.filter((order) => isRevenueOrder(order) && inWindow(order.paidAt, window) && order.fulfilmentStatus !== "cancelled");
  return {
    awaitingAction: orders.filter((order) => order.paymentStatus === "paid" && ["new", "picking", "packed"].includes(order.fulfilmentStatus)).length,
    inTransit: orders.filter((order) => order.fulfilmentStatus === "dispatched").length,
    lowStock: tracked.filter((record) => stockState(record) === "low").length,
    outOfStock: tracked.filter((record) => stockState(record) === "out").length,
    exceptions: orders.filter((order) => order.fulfilmentStatus === "exception" || (order.exception && !order.exception.resolvedAt)).length,
    pendingManualApprovals: orders.filter((order) => order.channel === "manual" && order.paymentStatus === "pending" && order.fulfilmentStatus !== "cancelled").length,
    refundsPending: orders.filter((order) => order.paymentStatus === "refund_pending").length,
    failedSms: notifications.filter((record) => record.status === "failed").length,
    books: { total: books.length, published: books.filter((book) => book.status === "published").length, drafts: books.filter((book) => book.status === "draft").length },
    sales30d: can(ctx, "reports.view") ? { window, orders: revenue.length, grossPesewas: revenue.reduce((sum, order) => sum + order.totalPesewas, 0) } : null,
    recentOrders: orders.slice(0, 8).map((order) => ({
      id: order.id,
      ref: order.ref,
      channel: order.channel,
      totalPesewas: order.totalPesewas,
      paymentStatus: order.paymentStatus,
      fulfilmentStatus: order.fulfilmentStatus,
      destination: `${order.address.city}, ${order.address.region}`,
      createdAt: order.createdAt,
    })),
  };
}

/* ------------------------------------------------------------------ Audit */

export async function listAudit(store: AdminDataStore, ctx: StaffContext, filter: { q?: string; entityType?: string; actorUid?: string; limit?: number } = {}): Promise<AuditEvent[]> {
  assertPermission(ctx, "audit.view");
  const events = await store.query("auditEvents", { orderBy: { field: "at", direction: "desc" }, limit: 2000 });
  const q = filter.q?.trim().toLowerCase();
  return events
    .filter((event) => (!filter.entityType || event.entityType === filter.entityType) && (!filter.actorUid || event.actorUid === filter.actorUid))
    .filter((event) => !q || [event.action, event.summary, event.entityId, event.actorName, event.reason ?? ""].join(" ").toLowerCase().includes(q))
    .slice(0, filter.limit ?? 300);
}
