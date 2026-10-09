import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Callout, EmptyState, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDateTime } from "@/lib/admin/format";
import { listNotifications, MAX_SMS_ATTEMPTS } from "@/lib/admin/ops/notifications";
import { getAdminStore } from "@/lib/admin/store";
import type { NotificationRecord } from "@/lib/admin/types";
import { retryNotificationAction } from "./actions";

export const metadata = { title: "SMS log" };

const TONE: Record<NotificationRecord["status"], "green" | "amber" | "red" | "blue" | "plain"> = { queued: "blue", sending: "blue", sent: "green", delivered: "green", failed: "red", suppressed: "plain" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ status?: string; orderId?: string }> }) {
  const access = await pageAccess("notifications.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const { status = "all", orderId } = await searchParams;
  const store = getAdminStore();
  const rows = await listNotifications(store, ctx, { status: status as NotificationRecord["status"] | "all", orderId });
  const orders = await store.query("orders");
  const refById = new Map(orders.map((order) => [order.id, order.ref]));

  return (
    <>
      <PageHeader eyebrow="Messages" title="SMS log" lede="Transactional SMS sent through mNotify after committed order events. Recipients are masked. Marketing messages are not sent from here." />
      <div style={{ marginBottom: 14 }}>
        <Callout tone="info">The admin never calls mNotify directly. Retrying a failed message re-queues it for the server worker; each event can only ever be sent once.</Callout>
      </div>
      <nav className="adm-tabs" aria-label="Status">
        {["all", "failed", "queued", "sent", "delivered", "suppressed"].map((value) => (
          <Link key={value} href={`/admin/notifications${value === "all" ? "" : `?status=${value}`}`} aria-current={status === value ? "page" : undefined}>{value[0].toUpperCase() + value.slice(1)}</Link>
        ))}
      </nav>
      {rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table" data-stack>
            <thead><tr><th>Event</th><th>Order</th><th>Recipient</th><th>Status</th><th>mNotify</th><th>Attempts</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="primary" data-label="Event"><strong>{row.event.replace(/_/g, " ")}</strong><span className="sub">{formatDateTime(row.createdAt)} · template {row.template} v{row.templateVersion}</span></td>
                  <td data-label="Order"><Link className="adm-link adm-mono" href={`/admin/orders/${row.orderId}`}>{refById.get(row.orderId) ?? row.orderId}</Link></td>
                  <td className="adm-mono" data-label="Recipient">{row.recipientMasked}</td>
                  <td data-label="Status"><Badge tone={TONE[row.status]}>{row.status}</Badge>{row.lastError ? <span className="sub" style={{ color: "var(--red)" }}>{row.lastError}</span> : null}</td>
                  <td className="adm-mono" data-label="mNotify">{row.mnotifyCampaignId ?? "—"}</td>
                  <td data-label="Attempts">{row.attempts} / {MAX_SMS_ATTEMPTS}</td>
                  <td data-label="">
                    {row.status === "failed" && can(ctx, "notifications.retry") && row.attempts < MAX_SMS_ATTEMPTS ? (
                      <ActionForm action={retryNotificationAction} idempotencyKey={randomUUID()} submitLabel="Retry" size="sm" variant="default" pendingLabel="Queuing…" inline>
                        <input type="hidden" name="notificationId" value={row.id} />
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={status === "failed" ? "No failed messages" : "No messages yet"} art="✉">Messages are created when orders are paid, dispatched, delivered, cancelled or refunded.</EmptyState>
      )}
    </>
  );
}
