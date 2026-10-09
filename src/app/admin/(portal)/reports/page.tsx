import Link from "next/link";
import { Fragment } from "react";
import { icons } from "@/components/admin/icons";
import { Callout, Card, EmptyState, Money, PageHeader, PermissionDenied, Stat } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { defaultWindow, lowStockReport, paymentsReport, salesReport, stockMovementReport, type DateWindow } from "@/lib/admin/ops/reports";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Reports" };

function validDay(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function hours(value: number | null): string {
  if (value === null) return "—";
  return value < 48 ? `${value} h` : `${Math.round(value / 24)} days`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const access = await pageAccess("reports.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const params = await searchParams;
  const fallback = defaultWindow(30);
  const window: DateWindow = { from: validDay(params.from) ? params.from : fallback.from, to: validDay(params.to) ? params.to : fallback.to };
  if (window.from > window.to) [window.from, window.to] = [window.to, window.from];
  const store = getAdminStore();
  const [sales, payments, movements, lowStock] = await Promise.all([salesReport(store, ctx, window), paymentsReport(store, ctx, window), stockMovementReport(store, ctx, window), lowStockReport(store, ctx)]);
  const query = `from=${window.from}&to=${window.to}`;
  const maxDay = Math.max(1, ...sales.days.map((day) => day.grossPesewas));
  const windowLabel = `${formatDate(`${window.from}T00:00:00Z`)} – ${formatDate(`${window.to}T00:00:00Z`)}`;

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Reports"
        lede={`${windowLabel} · Africa/Accra`}
        actions={
          <>
            <a className="adm-btn" href={`/admin/api/export/sales?${query}`}>{icons.download} Sales CSV</a>
            <a className="adm-btn" href={`/admin/api/export/movements?${query}`}>{icons.download} Stock movements CSV</a>
          </>
        }
      />
      <form className="adm-filters" action="/admin/reports">
        <label className="adm-field"><span>From</span><input type="date" name="from" defaultValue={window.from} /></label>
        <label className="adm-field"><span>To</span><input type="date" name="to" defaultValue={window.to} /></label>
        <button className="adm-btn" type="submit">Update</button>
        <Link className="adm-btn" data-variant="ghost" href="/admin/reports">Last 30 days</Link>
      </form>
      <div style={{ marginBottom: 16 }}>
        <Callout tone="info" title="How these numbers are calculated">
          Revenue includes only orders with verified payment, dated by when payment was verified. Unpaid, failed and abandoned orders are excluded ({sales.excluded.count} in this window). Gross includes delivery charges; net subtracts refunds Paystack or staff have confirmed as processed. All sums are in integer pesewas.
        </Callout>
      </div>

      <div className="adm-stats">
        <Stat label="Paid orders" value={sales.totals.orders} />
        <Stat label="Gross sales" value={<Money pesewas={sales.totals.grossPesewas} />} note={`incl. ${new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(sales.totals.deliveryPesewas / 100)} delivery`} />
        <Stat label="Refunds processed" value={<Money pesewas={sales.totals.refundsPesewas} />} />
        <Stat label="Net sales" value={<Money pesewas={sales.totals.netPesewas} />} tone="calm" />
        <Stat label="Median paid → dispatched" value={hours(sales.fulfilment.medianHoursToDispatch)} note={`${sales.fulfilment.dispatched} dispatched`} />
        <Stat label="Median paid → delivered" value={hours(sales.fulfilment.medianHoursToDelivery)} note={`${sales.fulfilment.delivered} delivered`} />
      </div>

      <Card title="Daily paid sales" description="Gross per day by payment date.">
        {sales.totals.orders ? (
          <>
            <div className="adm-bar-chart" role="img" aria-label={`Bar chart of daily paid sales, ${windowLabel}`}>
              {sales.days.map((day) => <div key={day.day} data-zero={day.grossPesewas === 0} style={{ height: `${Math.max(2, (day.grossPesewas / maxDay) * 100)}%` }} title={`${day.day}: ${day.orders} order(s)`} />)}
            </div>
            <div className="adm-small adm-muted" style={{ display: "flex", justifyContent: "space-between" }}><span>{formatDate(`${window.from}T00:00:00Z`)}</span><span>{formatDate(`${window.to}T00:00:00Z`)}</span></div>
          </>
        ) : (
          <EmptyState title="No paid orders in this window" art="∅" />
        )}
      </Card>

      <div className="adm-grid adm-grid-2" style={{ marginTop: 16 }}>
        <Card title="By title & variant">
          {sales.byVariant.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Variant</th><th className="num">Units</th><th className="num">Gross</th></tr></thead>
                <tbody>{sales.byVariant.slice(0, 15).map((row) => <tr key={row.sku}><td>{row.title}<span className="sub adm-mono">{row.sku} · {row.format}</span></td><td className="num">{row.units}</td><td className="num"><Money pesewas={row.grossPesewas} /></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="adm-muted adm-small">No sales.</p>}
        </Card>
        <Card title="By category" description="A book in two categories counts in both.">
          {sales.byCategory.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Category</th><th className="num">Units</th><th className="num">Gross (books)</th></tr></thead>
                <tbody>{sales.byCategory.map((row) => <tr key={row.name}><td>{row.name}</td><td className="num">{row.units}</td><td className="num"><Money pesewas={row.grossPesewas} /></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="adm-muted adm-small">No sales.</p>}
        </Card>
        <Card title="By delivery region">
          {sales.byRegion.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Region</th><th className="num">Orders</th><th className="num">Delivery</th><th className="num">Gross</th></tr></thead>
                <tbody>{sales.byRegion.map((row) => <tr key={row.region}><td>{row.region}</td><td className="num">{row.orders}</td><td className="num"><Money pesewas={row.deliveryPesewas} /></td><td className="num"><Money pesewas={row.grossPesewas} /></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="adm-muted adm-small">No sales.</p>}
        </Card>
        <Card title="By channel">
          {sales.byChannel.length ? (
            <dl className="adm-dl">{sales.byChannel.map((row) => <Fragment key={row.channel}><dt>{row.channel === "manual" ? "Manual / offsite" : "Website (Paystack)"}</dt><dd>{row.orders} order(s) · <Money pesewas={row.grossPesewas} /></dd></Fragment>)}</dl>
          ) : <p className="adm-muted adm-small">No sales.</p>}
        </Card>
        <Card title="Payments & refunds">
          {payments.payments.length || payments.refunds.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Payment</th><th>Status</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {payments.payments.slice(0, 20).map((payment) => <tr key={payment.id}><td><Link className="adm-link adm-mono" href={`/admin/orders/${payment.orderId}`}>{payment.reference}</Link><span className="sub">{payment.provider} · {formatDateTime(payment.createdAt)}</span></td><td>{payment.providerStatus}{payment.verified ? "" : " (unverified)"}{payment.refundedPesewas ? <span className="sub">refunded <Money pesewas={payment.refundedPesewas} /></span> : null}</td><td className="num"><Money pesewas={payment.amountPesewas} /></td></tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="adm-muted adm-small">No payment records in this window.</p>}
        </Card>
        <Card title="Stock movements" actions={<a className="adm-link adm-small" href={`/admin/api/export/movements?${query}`}>CSV →</a>}>
          {movements.byType.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Type</th><th className="num">Entries</th><th className="num">Net on hand</th></tr></thead>
                <tbody>{movements.byType.map((row) => <tr key={row.type}><td className="adm-mono">{row.type}</td><td className="num">{row.count}</td><td className="num">{row.onHandDelta > 0 ? "+" : ""}{row.onHandDelta}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="adm-muted adm-small">No movements in this window.</p>}
        </Card>
      </div>

      <Card title="Low & out of stock" description="Current, not windowed." actions={<a className="adm-link adm-small" href="/admin/api/export/low-stock">CSV →</a>}>
        {lowStock.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table" data-stack>
              <thead><tr><th>SKU</th><th className="num">Available</th><th className="num">Threshold</th><th>Published</th></tr></thead>
              <tbody>{lowStock.map((row) => <tr key={row.sku}><td className="primary" data-label="SKU"><Link className="adm-link adm-mono" href={`/admin/inventory/${encodeURIComponent(row.sku)}`}>{row.sku}</Link><span className="sub">{row.title}</span></td><td className="num" data-label="Available">{row.available}</td><td className="num" data-label="Threshold">{row.threshold}</td><td data-label="Published">{row.published ? "Yes" : "No"}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="adm-muted adm-small">Everything active is above its threshold.</p>}
      </Card>
    </>
  );
}
