import Link from "next/link";
import { Callout, EmptyState, Money, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDate } from "@/lib/admin/format";
import { listCustomers } from "@/lib/admin/ops/reports";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await pageAccess("customers.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const { q = "" } = await searchParams;
  const customers = await listCustomers(getAdminStore(), ctx, q);
  const contact = can(ctx, "customers.view_contact");

  return (
    <>
      <PageHeader eyebrow="People" title="Customers" lede="A support view derived from orders, grouped by phone number. There are no customer accounts to manage here." />
      <div style={{ marginBottom: 14 }}>
        <Callout tone="info">Use this to help a customer with an order. Do not export or reuse contact details for marketing — marketing SMS needs separate opt-in.</Callout>
      </div>
      <form className="adm-filters" role="search" action="/admin/customers">
        <label className="adm-field grow">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q} placeholder={contact ? "Name, phone, email or order ref" : "Name or order ref"} />
        </label>
        <button className="adm-btn" type="submit">Search</button>
      </form>
      {customers.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table" data-stack>
            <thead><tr><th>Customer</th><th>Contact</th><th className="num">Orders</th><th className="num">Paid total</th><th>Last order</th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.key}>
                  <td className="primary" data-label="Customer"><strong>{customer.name}</strong><span className="sub">{customer.regions.join(", ")}</span></td>
                  <td data-label="Contact">{customer.phone}<span className="sub">{customer.email}</span></td>
                  <td className="num" data-label="Orders">{customer.orders}<span className="sub">{customer.paidOrders} paid</span></td>
                  <td className="num" data-label="Paid total"><Money pesewas={customer.lifetimePesewas} /></td>
                  <td data-label="Last order"><Link className="adm-link adm-mono" href={`/admin/orders/${customer.lastOrderId}`}>{customer.lastOrderRef}</Link><span className="sub">{formatDate(customer.lastOrderAt)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={q ? "No customers match" : "No customers yet"} art="☺">{q ? "Try an order reference, or the customer’s name as written on the order." : "Customers appear here once orders exist."}</EmptyState>
      )}
    </>
  );
}
