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
      <PageHeader eyebrow="People" title="Customers" lede="Everyone who has ordered, grouped by phone number. Use it to help customers. Customers don’t have accounts." />
      <div style={{ marginBottom: 14 }}>
        <Callout tone="info">Only use this to help a customer with an order. Don’t copy contact details to send adverts. Customers must say yes before you send them adverts.</Callout>
      </div>
      <form className="adm-filters" role="search" action="/admin/customers">
        <label className="adm-field grow">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q} placeholder={contact ? "Name, phone, email or order number" : "Name or order number"} />
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
        <EmptyState title={q ? "No customers match" : "No customers yet"} icon="customers">{q ? "Try an order number, or the customer’s name as it is on the order." : "Customers show up here after they order."}</EmptyState>
      )}
    </>
  );
}
