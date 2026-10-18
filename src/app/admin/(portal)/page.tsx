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
        lede="Here’s what needs your attention today: orders, stock and messages."
        actions={
          <>
            {can(ctx, "orders.manual_sale") ? <Link className="adm-btn" href="/admin/orders/new">{icons.manual} Add a sale</Link> : null}
            {can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">{icons.plus} Add a book</Link> : null}
          </>
        }
      />

      <div className="adm-stats">
        <Stat label="Paid, ready to pack" value={summary.awaitingAction} href="/admin/orders?payment=paid&fulfilment=open" tone={summary.awaitingAction ? "alert" : "calm"} note="Not sent out yet" />
        <Stat label="On the way" value={summary.inTransit} href="/admin/orders?fulfilment=dispatched" note="Sent out, not delivered yet" />
        <Stat label="Low stock" value={summary.lowStock} href="/admin/inventory?state=low" tone={summary.lowStock ? "alert" : "calm"} note="Running low" />
        <Stat label="Out of stock" value={summary.outOfStock} href="/admin/inventory?state=out" tone={summary.outOfStock ? "alert" : "calm"} note="None left to sell" />
        <Stat label="Needs checking" value={summary.exceptions + summary.pendingManualApprovals + summary.refundsPending} href="/admin/orders?exceptions=1" tone={summary.exceptions ? "alert" : "calm"} note={`${summary.exceptions} problem · ${summary.pendingManualApprovals} to approve · ${summary.refundsPending} refunds`} />
        <Stat label="Texts not sent" value={summary.failedSms} href="/admin/notifications?status=failed" tone={summary.failedSms ? "alert" : "calm"} note="You can try again" />
      </div>

      <div className="adm-grid adm-grid-main">
        <Card title="Recent orders" description="Newest first, website and other sales" actions={<Link className="adm-link" href="/admin/orders">All orders {icons.arrowRight}</Link>}>
          {summary.recentOrders.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table" data-stack>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Delivering to</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="primary" data-label="Order">
                        <Link className="row-link adm-mono" href={`/admin/orders/${order.id}`}>{order.ref}</Link>
                        <span className="sub">{formatDateTime(order.createdAt)}{order.channel === "manual" ? " · Not on website" : ""}</span>
                      </td>
                      <td data-label="Payment"><PaymentBadge status={order.paymentStatus} /></td>
                      <td data-label="Status"><FulfilmentBadge status={order.fulfilmentStatus} /></td>
                      <td data-label="Delivering to">{order.destination}</td>
                      <td className="num" data-label="Total"><Money pesewas={order.totalPesewas} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No orders yet" icon="mail">Website orders show up here once online payment is turned on and Paystack confirms a payment. You can add Instagram or WhatsApp sales with “Add a sale”.</EmptyState>
          )}
        </Card>

        <div className="adm-stack">
          {summary.sales30d ? (
            <Card title="Paid sales" description={`${formatDate(`${summary.sales30d.window.from}T00:00:00Z`)} – ${formatDate(`${summary.sales30d.window.to}T00:00:00Z`)} (last 30 days)`}>
              <p style={{ margin: 0, fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}><Money pesewas={summary.sales30d.grossPesewas} /></p>
              <p className="adm-muted adm-small" style={{ margin: "4px 0 10px" }}>{summary.sales30d.orders} paid order(s), with delivery included. Unpaid and cancelled orders are left out. See Reports for refunds.</p>
              <Link className="adm-link" href="/admin/reports">Open reports {icons.arrowRight}</Link>
            </Card>
          ) : null}
          <Card title="Products">
            {summary.books.total ? (
              <dl className="adm-dl">
                <dt>In the shop</dt><dd>{summary.books.published}</dd>
                <dt>Drafts</dt><dd>{summary.books.drafts}</dd>
                <dt>All products</dt><dd>{summary.books.total}</dd>
              </dl>
            ) : (
              <EmptyState title="Add your first book" icon="book" action={can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">Add a book</Link> : undefined}>
                Add the book, then add an option (like Paperback) with its price and weight. Add your stock, upload a cover photo, then publish it.
              </EmptyState>
            )}
          </Card>
          {summary.pendingManualApprovals && can(ctx, "payments.approve_manual") ? (
            <Callout tone="warn" title={`${summary.pendingManualApprovals} sale(s) waiting for you to approve the payment`}>
              <Link className="adm-link" href="/admin/orders?channel=manual&payment=pending">Review payment proof {icons.arrowRight}</Link>
            </Callout>
          ) : null}
        </div>
      </div>
    </>
  );
}
