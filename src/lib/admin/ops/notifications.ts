import { recordAudit } from "@/lib/admin/audit";
import { assertPermission, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { maskPhone } from "@/lib/admin/format";
import { derivedId, nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";
import type { NotificationEvent, NotificationRecord, Order } from "@/lib/admin/types";

/**
 * Transactional SMS outbox.
 *
 * The admin never calls mNotify. Committed order events enqueue a
 * `notifications` record here (inside the same transaction as the order
 * change); the shared server worker (request R6) sends it via mNotify
 * `POST /api/sms/quick` and records the campaign ID and delivery status.
 *
 * The document ID is derived from the event key, so an event can only ever be
 * enqueued once — duplicate clicks and retries cannot double-send.
 */

export const MAX_SMS_ATTEMPTS = 5;

export const SMS_TEMPLATES: Record<NotificationEvent, { template: string; version: number }> = {
  order_paid: { template: "order_paid", version: 1 },
  order_dispatched: { template: "order_dispatched", version: 1 },
  order_delivered: { template: "order_delivered", version: 1 },
  order_cancelled: { template: "order_cancelled", version: 1 },
  refund_processed: { template: "refund_processed", version: 1 },
};

export function notificationIdFor(eventKey: string): string {
  return derivedId("ntf", eventKey);
}

/**
 * Enqueue an SMS for a committed order event. Callers must have already read
 * `existing` via `tx.get("notifications", notificationIdFor(eventKey))` before
 * writing (reads-before-writes); if it exists this is a no-op.
 */
export function enqueueOrderSms(tx: AdminTransaction, order: Order, event: NotificationEvent, existing: NotificationRecord | null, smsEnabled: boolean): NotificationRecord | null {
  const eventKey = `${order.id}:${event}`;
  if (existing) return null;
  const at = nowIso();
  const { template, version } = SMS_TEMPLATES[event];
  const record: NotificationRecord = {
    id: notificationIdFor(eventKey),
    eventKey,
    event,
    orderId: order.id,
    recipient: order.customer.phone,
    template,
    templateVersion: version,
    status: smsEnabled ? "queued" : "suppressed",
    attempts: 0,
    createdAt: at,
    updatedAt: at,
    ...(smsEnabled ? {} : { lastError: "SMS disabled in site settings at the time of the event." }),
  };
  tx.create("notifications", record.id, record);
  return record;
}

export async function readNotificationSlot(tx: AdminTransaction, orderId: string, event: NotificationEvent) {
  return tx.get("notifications", notificationIdFor(`${orderId}:${event}`));
}

export async function retryNotification(store: AdminDataStore, ctx: StaffContext, notificationId: string, idempotencyKey: string) {
  assertPermission(ctx, "notifications.retry");
  return runIdempotent(store, ctx, "notifications.retry", idempotencyKey, async (tx) => {
    const record = await tx.get("notifications", notificationId);
    if (!record) throw new AdminError("not_found", "Notification not found.");
    if (record.status !== "failed") throw new AdminError("precondition", `Only failed messages can be retried (this one is ${record.status}).`);
    if (record.attempts >= MAX_SMS_ATTEMPTS) throw new AdminError("precondition", `This message has already been attempted ${record.attempts} times. Contact the customer directly.`);
    tx.update("notifications", notificationId, { status: "queued", updatedAt: nowIso() });
    recordAudit(tx, ctx, { action: "notifications.retry", entityType: "notification", entityId: notificationId, summary: `Re-queued ${record.event} SMS for order ${record.orderId} (attempt ${record.attempts + 1})` });
    return { notificationId };
  });
}

export interface NotificationRow extends Omit<NotificationRecord, "recipient"> {
  recipientMasked: string;
}

export function maskNotification(record: NotificationRecord): NotificationRow {
  const { recipient, ...rest } = record;
  return { ...rest, recipientMasked: maskPhone(recipient) };
}

export async function listNotifications(store: AdminDataStore, ctx: StaffContext, filter: { status?: NotificationRecord["status"] | "all"; orderId?: string } = {}): Promise<NotificationRow[]> {
  assertPermission(ctx, "notifications.view");
  const where: [keyof NotificationRecord & string, "==", unknown][] = [];
  if (filter.status && filter.status !== "all") where.push(["status", "==", filter.status]);
  if (filter.orderId) where.push(["orderId", "==", filter.orderId]);
  const rows = await store.query("notifications", { where, orderBy: { field: "createdAt", direction: "desc" }, limit: 500 });
  // Even with contact permission, the notification centre shows masked numbers.
  return rows.map(maskNotification);
}
