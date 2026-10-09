import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { Badge, EmptyState, FulfilmentBadge, Money, PageHeader, PaymentBadge, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { FULFILMENT_LABELS, PAYMENT_LABELS, formatDateTime } from "@/lib/admin/format";
import { listOrders, type OrderFilter } from "@/lib/admin/ops/orders";
import { getAdminStore } from "@/lib/admin/store";
import { FULFILMENT_STATUSES, PAYMENT_STATUSES } from "@/lib/admin/types";
import { GHANA_REGIONS } from "@/lib/admin/validation";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await pageAccess("orders.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const params = await searchParams;
  const filter: OrderFilter = {
    payment: (params.payment as OrderFilter["payment"]) || "all",
    fulfilment: (params.fulfilment as OrderFilter["fulfilment"]) || "all",
    channel: (params.channel as OrderFilter["channel"]) || "all",
    q: params.q,
    region: params.region || undefined,
    courier: params.courier || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    exceptions: params.exceptions === "1",
  };
  const store = getAdminStore();
  const [rows, total] = await Promise.all([listOrders(store, ctx, filter), store.query("orders", { limit: 1 })]);
  const exportQuery = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title="Orders"
        lede="Payment and fulfilment are tracked separately. Only Paystack verification marks a website order paid."
        actions={
          <>
            <a className="adm-btn" href={`/admin/api/export/orders${exportQuery ? `?${exportQuery}` : ""}`}>{icons.download} Export CSV</a>
            {can(ctx, "orders.manual_sale") ? <Link className="adm-btn" data-variant="primary" href="/admin/orders/new">{icons.plus} Manual sale</Link> : null}
          </>
        }
      />
      <nav className="adm-tabs" aria-label="Quick filters">
        <Link href="/admin/orders" aria-current={!Object.values(params).some(Boolean) ? "page" : undefined}>All</Link>
        <Link href="/admin/orders?payment=paid&fulfilment=open" aria-current={params.payment === "paid" && params.fulfilment === "open" ? "page" : undefined}>To fulfil</Link>
        <Link href="/admin/orders?fulfilment=dispatched" aria-current={params.fulfilment === "dispatched" && !params.payment ? "page" : undefined}>In transit</Link>
        <Link href="/admin/orders?payment=pending" aria-current={params.payment === "pending" && !params.channel ? "page" : undefined}>Awaiting payment</Link>
        <Link href="/admin/orders?exceptions=1" aria-current={params.exceptions === "1" ? "page" : undefined}>Exceptions</Link>
        <Link href="/admin/orders?channel=manual" aria-current={params.channel === "manual" && !params.payment ? "page" : undefined}>Manual sales</Link>
      </nav>
      <form className="adm-filters" role="search" action="/admin/orders">
        <label className="adm-field grow">
          <span>Search</span>
          <input type="search" name="q" defaultValue={params.q} placeholder={can(ctx, "customers.view_contact") ? "Order ref, customer, phone, email, Paystack ref" : "Order ref, customer name, city"} />
        </label>
        <label className="adm-field">
          <span>Payment</span>
          <select name="payment" defaultValue={filter.payment}>
            <option value="all">Any payment</option>
            {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{PAYMENT_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="adm-field">
          <span>Fulfilment</span>
          <select name="fulfilment" defaultValue={filter.fulfilment}>
            <option value="all">Any fulfilment</option>
            <option value="open">Open (not closed)</option>
            {FULFILMENT_STATUSES.map((status) => <option key={status} value={status}>{FULFILMENT_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="adm-field">
          <span>Channel</span>
          <select name="channel" defaultValue={filter.channel}>
            <option value="all">All channels</option>
            <option value="website">Website (Paystack)</option>
            <option value="manual">Manual / offsite</option>
          </select>
        </label>
        <details className="adm-more-filters" open={Boolean(params.region || params.courier || params.from || params.to || params.exceptions)}>
          <summary>More filters</summary>
          <div className="adm-filters">
          <label className="adm-field">
            <span>Region</span>
            <select name="region" defaultValue={params.region ?? ""}>
              <option value="">All regions</option>
              {GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}
            </select>
          </label>
          <label className="adm-field">
            <span>Courier</span>
            <input type="text" name="courier" defaultValue={params.courier} />
          </label>
          <label className="adm-field">
            <span>From</span>
            <input type="date" name="from" defaultValue={params.from} />
          </label>
          <label className="adm-field">
            <span>To</span>
            <input type="date" name="to" defaultValue={params.to} />
          </label>
          <label className="adm-check" style={{ alignSelf: "center" }}>
            <input type="checkbox" name="exceptions" value="1" defaultChecked={filter.exceptions} /> Exceptions only
          </label>
          </div>
        </details>
        <button className="adm-btn" type="submit">Apply</button>
      </form>

      {!total.length ? (
        <EmptyState title="No orders yet" art="✉" action={can(ctx, "orders.manual_sale") ? <Link className="adm-btn" data-variant="primary" href="/admin/orders/new">Record a manual sale</Link> : undefined}>
          Website orders appear here after checkout creates them. Instagram, WhatsApp, phone or walk-in sales can be recorded as manual sales using the same stock ledger.
        </EmptyState>
      ) : !rows.length ? (
        <EmptyState title="No orders match these filters" art="⌕" action={<Link className="adm-btn" href="/admin/orders">Clear filters</Link>} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table" data-stack>
            <caption className="sr-only">{rows.length} orders</caption>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Destination</th>
                <th>Payment</th>
                <th>Fulfilment</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="primary" data-label="Order">
                    <Link className="row-link adm-mono" href={`/admin/orders/${row.id}`}>{row.ref}</Link>
                    <span className="sub">{formatDateTime(row.createdAt)} · {row.itemCount} item(s)</span>
                    {row.channel === "manual" ? <Badge tone="lavender">Manual</Badge> : null} {row.hasException ? <Badge tone="red">Exception</Badge> : null}
                  </td>
                  <td data-label="Customer">{row.customerName}<span className="sub">{row.customerContact}</span></td>
                  <td data-label="Destination">{row.city}<span className="sub">{row.region}{row.courier ? ` · ${row.courier}` : ""}</span></td>
                  <td data-label="Payment"><PaymentBadge status={row.paymentStatus} /></td>
                  <td data-label="Fulfilment"><FulfilmentBadge status={row.fulfilmentStatus} /></td>
                  <td className="num" data-label="Total"><Money pesewas={row.totalPesewas} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
