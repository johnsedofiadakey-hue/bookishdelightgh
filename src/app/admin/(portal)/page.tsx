import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { Callout, Card, EmptyState, FulfilmentBadge, Money, PageHeader, PaymentBadge, PermissionDenied, Stat } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { dashboardSummary } from "@/lib/admin/ops/reports";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const access = await pageAccess("dashboard.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const summary = await dashboardSummary(getAdminStore(), ctx);

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Accra" }).format(new Date())}
        title={<>Good to see you, <em>{ctx.name}.</em></>}
        lede="Here’s what needs attention across orders, stock and messages."
        actions={
          <>
            {can(ctx, "orders.manual_sale") ? <Link className="adm-btn" href="/admin/orders/new">{icons.manual} Manual sale</Link> : null}
            {can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">{icons.plus} Add a book</Link> : null}
          </>
        }
      />

      <div className="adm-stats">
        <Stat label="Paid, awaiting fulfilment" value={summary.awaitingAction} href="/admin/orders?payment=paid&fulfilment=open" tone={summary.awaitingAction ? "alert" : "calm"} note="New, picking or packed" />
        <Stat label="In transit" value={summary.inTransit} href="/admin/orders?fulfilment=dispatched" note="Dispatched, not yet delivered" />
        <Stat label="Low stock" value={summary.lowStock} href="/admin/inventory?state=low" tone={summary.lowStock ? "alert" : "calm"} note="At or below threshold" />
        <Stat label="Out of stock" value={summary.outOfStock} href="/admin/inventory?state=out" tone={summary.outOfStock ? "alert" : "calm"} note="Active variants, 0 available" />
        <Stat label="Exceptions" value={summary.exceptions + summary.pendingManualApprovals + summary.refundsPending} href="/admin/orders?exceptions=1" tone={summary.exceptions ? "alert" : "calm"} note={`${summary.exceptions} order · ${summary.pendingManualApprovals} manual pay · ${summary.refundsPending} refunds`} />
        <Stat label="Failed SMS" value={summary.failedSms} href="/admin/notifications?status=failed" tone={summary.failedSms ? "alert" : "calm"} note="Safe to retry" />
      </div>

      <div className="adm-grid adm-grid-main">
        <Card title="Recent orders" description="Newest first, all channels" actions={<Link className="adm-link" href="/admin/orders">All orders →</Link>}>
          {summary.recentOrders.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table" data-stack>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Payment</th>
                    <th>Fulfilment</th>
                    <th>Destination</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="primary" data-label="Order">
                        <Link className="row-link adm-mono" href={`/admin/orders/${order.id}`}>{order.ref}</Link>
                        <span className="sub">{formatDateTime(order.createdAt)}{order.channel === "manual" ? " · Manual" : ""}</span>
                      </td>
                      <td data-label="Payment"><PaymentBadge status={order.paymentStatus} /></td>
                      <td data-label="Fulfilment"><FulfilmentBadge status={order.fulfilmentStatus} /></td>
                      <td data-label="Destination">{order.destination}</td>
                      <td className="num" data-label="Total"><Money pesewas={order.totalPesewas} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No orders yet" art="✉">Website orders appear here once checkout is live and Paystack verifies payment. Instagram or WhatsApp sales can be recorded as manual sales.</EmptyState>
          )}
        </Card>

        <div className="adm-stack">
          {summary.sales30d ? (
            <Card title="Paid sales" description={`${formatDate(`${summary.sales30d.window.from}T00:00:00Z`)} – ${formatDate(`${summary.sales30d.window.to}T00:00:00Z`)} (last 30 days)`}>
              <p style={{ margin: 0, fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}><Money pesewas={summary.sales30d.grossPesewas} /></p>
              <p className="adm-muted adm-small" style={{ margin: "4px 0 10px" }}>{summary.sales30d.orders} paid order(s), including delivery charges. Excludes unpaid and cancelled orders; refunds are shown in Reports.</p>
              <Link className="adm-link" href="/admin/reports">Open reports →</Link>
            </Card>
          ) : null}
          <Card title="Catalogue">
            {summary.books.total ? (
              <dl className="adm-dl">
                <dt>Published</dt><dd>{summary.books.published}</dd>
                <dt>Drafts</dt><dd>{summary.books.drafts}</dd>
                <dt>All books</dt><dd>{summary.books.total}</dd>
              </dl>
            ) : (
              <EmptyState title="Add your first book" art="📖" action={can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">Add a book</Link> : undefined}>
                Create the book, add a format variant with price and weight, receive opening stock, upload a cover, then publish.
              </EmptyState>
            )}
          </Card>
          {summary.pendingManualApprovals && can(ctx, "payments.approve_manual") ? (
            <Callout tone="warn" title={`${summary.pendingManualApprovals} manual sale(s) awaiting payment approval`}>
              <Link className="adm-link" href="/admin/orders?channel=manual&payment=pending">Review payment evidence →</Link>
            </Callout>
          ) : null}
        </div>
      </div>
    </>
  );
}
