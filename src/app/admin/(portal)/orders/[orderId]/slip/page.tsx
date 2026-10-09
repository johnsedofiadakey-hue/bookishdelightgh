import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { formatDateTime } from "@/lib/admin/format";
import { getOrderDetail } from "@/lib/admin/ops/orders";
import { getAdminStore } from "@/lib/admin/store";
import { PrintButton } from "./print-button";

export const metadata = { title: "Packing slip" };

export default async function SlipPage({ params }: { params: Promise<{ orderId: string }> }) {
  const access = await pageAccess("orders.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { orderId } = await params;
  const detail = await getOrderDetail(getAdminStore(), access.ctx, orderId);
  if (!detail) notFound();
  const { order } = detail;
  const units = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <div className="adm-no-print adm-form-foot" style={{ marginBottom: 16 }}>
        <Link className="adm-btn" href={`/admin/orders/${order.id}`}>← Back to order</Link>
        <PrintButton />
        {!detail.contactVisible ? <span className="adm-small adm-muted">Address is masked for your role; ask fulfilment to print.</span> : null}
      </div>
      <article className="adm-slip">
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p className="adm-eyebrow">Bookish Delight · Packing slip</p>
            <h1 className="adm-mono" style={{ fontFamily: "var(--mono)" }}>{order.ref}</h1>
            <p className="adm-small adm-muted" style={{ margin: 0 }}>Ordered {formatDateTime(order.createdAt)} · {order.channel === "manual" ? `Manual (${order.manualChannel})` : "Website"}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>{order.delivery.serviceLevel === "pickup" ? "PICKUP" : order.delivery.serviceLevel.toUpperCase()}</strong>
            <p className="adm-small" style={{ margin: 0 }}>{order.delivery.estimate}</p>
            {order.courier ? <p className="adm-small" style={{ margin: 0 }}>{order.courier}{order.trackingReference ? ` · ${order.trackingReference}` : ""}</p> : null}
          </div>
        </header>
        <section style={{ marginTop: 18 }}>
          <h3>Deliver to</h3>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            <strong>{order.customer.name}</strong> · {order.customer.phone}
            <br />
            {order.address.addressLine}
            {order.address.landmark ? <><br />Landmark: {order.address.landmark}</> : null}
            <br />
            {order.address.city}, {order.address.region}
            {order.address.ghanaPostGps ? <><br />GPS: {order.address.ghanaPostGps}</> : null}
            {order.address.notes ? <><br />Notes: {order.address.notes}</> : null}
          </p>
        </section>
        <table>
          <thead><tr><th style={{ width: 30 }}>✓</th><th>Title</th><th>Format</th><th>SKU</th><th>Qty</th></tr></thead>
          <tbody>
            {order.lines.map((line, index) => (
              <tr key={`${line.sku}-${index}`}>
                <td><span className="check" /></td>
                <td>{line.title}</td>
                <td>{line.format}</td>
                <td className="adm-mono">{line.sku}</td>
                <td><strong>{line.quantity}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><strong>{units}</strong> unit(s) in total. Packed by: ____________________ Date: ____________</p>
        <p className="adm-small adm-muted">Thank you for reading with Bookish Delight. Questions? Reply to our SMS or contact support.</p>
      </article>
    </>
  );
}
