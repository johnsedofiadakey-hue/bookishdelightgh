import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/action-form";
import { icons } from "@/components/admin/icons";
import { Badge, Callout, Card, FulfilmentBadge, Money, PageHeader, PaymentBadge, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { FULFILMENT_LABELS, formatDateTime, pesewasToDecimal } from "@/lib/admin/format";
import { canTransition, FULFILMENT_TRANSITIONS, getOrderDetail, refundedSoFar } from "@/lib/admin/ops/orders";
import { getAdminStore } from "@/lib/admin/store";
import type { FulfilmentStatus, Order } from "@/lib/admin/types";
import { approvePaymentAction, courierAction, noteAction, refundAction, transitionAction } from "../actions";

export const metadata = { title: "Order" };

const FLOW: FulfilmentStatus[] = ["new", "picking", "packed", "dispatched", "delivered"];

const ACTION_LABEL: Partial<Record<FulfilmentStatus, string>> = {
  picking: "Start picking",
  packed: "Mark packed",
  dispatched: "Mark dispatched",
  delivered: "Confirm delivered",
  new: "Move back to new",
  cancelled: "Cancel order",
  exception: "Flag exception",
  returned: "Record return",
};

function TransitionForm({ order, to }: { order: Order; to: FulfilmentStatus }) {
  const primary = ["picking", "packed", "dispatched", "delivered"].includes(to);
  const destructive = to === "cancelled";
  const back = FLOW.indexOf(to) >= 0 && FLOW.indexOf(to) < FLOW.indexOf(order.fulfilmentStatus);
  const label = back ? `Back to ${FULFILMENT_LABELS[to].toLowerCase()}` : ACTION_LABEL[to] ?? FULFILMENT_LABELS[to];
  return (
    <ActionForm
      action={transitionAction}
      idempotencyKey={randomUUID()}
      submitLabel={label}
      variant={destructive ? "danger" : primary && !back ? "coral" : "default"}
      confirm={destructive ? "Cancel this order? Reserved stock is released or restocked automatically. This cannot be undone." : to === "returned" ? "Record this order as returned?" : undefined}
    >
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="expectedFrom" value={order.fulfilmentStatus} />
      <input type="hidden" name="to" value={to} />
      {to === "dispatched" ? (
        <div className="adm-fields">
          <Field name="courier" label="Courier" required>
            <input type="text" name="courier" defaultValue={order.courier} required list="adm-couriers" />
          </Field>
          <Field name="trackingReference" label="Tracking / waybill ref">
            <input type="text" name="trackingReference" defaultValue={order.trackingReference} />
          </Field>
        </div>
      ) : null}
      {to === "delivered" ? (
        <Field name="deliveryProofNote" label="Proof of delivery (optional)">
          <input type="text" name="deliveryProofNote" placeholder="e.g. Received by Ama at gate, photo on WhatsApp" maxLength={500} />
        </Field>
      ) : null}
      {to === "cancelled" || to === "exception" || to === "returned" ? (
        <Field name="note" label={to === "exception" ? "What went wrong?" : "Reason"} required>
          <input type="text" name="note" maxLength={500} required />
        </Field>
      ) : null}
      {to === "returned" && order.stockState === "sold" ? (
        <label className="adm-check">
          <input type="checkbox" name="restock" /> Copies are resaleable — put them back on the shelf
        </label>
      ) : null}
    </ActionForm>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const access = await pageAccess("orders.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const { orderId } = await params;
  const detail = await getOrderDetail(getAdminStore(), ctx, orderId);
  if (!detail) notFound();
  const { order, payment, movements, notifications, audit, contactVisible } = detail;

  const transitions = FULFILMENT_TRANSITIONS[order.fulfilmentStatus].filter((to) => can(ctx, to === "cancelled" ? "orders.cancel" : "orders.fulfil"));
  const allowed = transitions.filter((to) => canTransition(order, to).ok);
  const blockedReason = transitions.map((to) => canTransition(order, to)).flatMap((check) => (check.ok ? [] : [check.reason]))[0];
  const forward = allowed.filter((to) => FLOW.indexOf(to) > FLOW.indexOf(order.fulfilmentStatus) || (order.fulfilmentStatus === "exception" && FLOW.includes(to)));
  const other = allowed.filter((to) => !forward.includes(to));
  const refundable = payment && payment.verified ? payment.amountPesewas - refundedSoFar(payment) : 0;
  const settled = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/orders", label: "Orders" }]}
        eyebrow={`${order.channel === "manual" ? `Manual sale · ${order.manualChannel}` : "Website order"} · ${formatDateTime(order.createdAt)}`}
        title={<span style={{ fontFamily: "var(--mono)", fontSize: "0.85em" }}>{order.ref}</span>}
        lede={<><PaymentBadge status={order.paymentStatus} /> <FulfilmentBadge status={order.fulfilmentStatus} /> {order.channel === "manual" ? <Badge tone="lavender">Manual / offsite</Badge> : <Badge tone="blue">Paystack</Badge>}</>}
        actions={<Link className="adm-btn" href={`/admin/orders/${order.id}/slip`}>{icons.print} Packing slip</Link>}
      />
      <datalist id="adm-couriers">
        <option value="Own rider" />
        <option value="VIP Bus parcel" />
        <option value="STC parcel" />
        <option value="Ghana Post EMS" />
      </datalist>

      <div className="adm-stack" style={{ marginBottom: 16 }}>
        {order.paymentStatus === "pending" && order.channel === "website" ? (
          <Callout tone="warn" title="Awaiting Paystack verification">This order cannot be picked or dispatched until the Paystack webhook/verification marks it paid. Staff cannot mark website orders as paid.</Callout>
        ) : null}
        {order.paymentStatus === "pending" && order.channel === "manual" ? (
          <Callout tone="warn" title="Manual payment awaiting approval">
            Evidence: <span className="adm-mono">{payment?.manualEvidence ?? "—"}</span> ({payment?.manualMethod}) for <Money pesewas={payment?.amountPesewas ?? 0} />.
            {can(ctx, "payments.approve_manual") ? (
              <div style={{ marginTop: 10 }}>
                <ActionForm action={approvePaymentAction} idempotencyKey={randomUUID()} submitLabel="Approve payment & commit stock" variant="coral" confirm="Confirm you have verified this payment was received in full.">
                  <input type="hidden" name="orderId" value={order.id} />
                </ActionForm>
              </div>
            ) : (
              <p style={{ margin: "6px 0 0" }}>A manager or owner must approve it.</p>
            )}
          </Callout>
        ) : null}
        {order.paymentStatus === "refund_pending" ? <Callout tone="info" title="Refund in progress">Fulfilment is paused until the refund is confirmed by Paystack.</Callout> : null}
        {order.exception && !order.exception.resolvedAt ? <Callout tone="danger" title="Exception">{order.exception.detail} <span className="adm-small">(raised {formatDateTime(order.exception.raisedAt)})</span></Callout> : null}
      </div>

      <div className="adm-grid adm-grid-main">
        <div className="adm-stack">
          <Card title="Fulfilment" description="Every step records who and when.">
            <ol className="adm-steps">
              {FLOW.map((status) => {
                const reached = order.fulfilmentHistory.some((event) => event.to === status);
                return <li key={status} data-state={order.fulfilmentStatus === status ? "current" : reached ? "done" : undefined}>{FULFILMENT_LABELS[status]}</li>;
              })}
            </ol>
            {forward.length ? <div className="adm-stack">{forward.map((to) => <TransitionForm key={to} order={order} to={to} />)}</div> : null}
            {blockedReason && !forward.length ? <p className="adm-small adm-muted">{blockedReason}</p> : null}
            {!transitions.length ? <p className="adm-muted adm-small">{["delivered", "cancelled", "returned"].includes(order.fulfilmentStatus) && !FULFILMENT_TRANSITIONS[order.fulfilmentStatus].length ? "This order is closed." : "Your role cannot change fulfilment."}</p> : null}
            {other.length ? (
              <details style={{ marginTop: 12 }}>
                <summary className="adm-link" style={{ cursor: "pointer" }}>Other actions ({other.map((to) => FULFILMENT_LABELS[to].toLowerCase()).join(", ")})</summary>
                <div className="adm-stack" style={{ paddingTop: 12 }}>{other.map((to) => <TransitionForm key={to} order={order} to={to} />)}</div>
              </details>
            ) : null}
            {can(ctx, "orders.fulfil") && !["delivered", "cancelled", "returned"].includes(order.fulfilmentStatus) && order.fulfilmentStatus !== "packed" ? (
              <details style={{ marginTop: 12 }}>
                <summary className="adm-link" style={{ cursor: "pointer" }}>Courier &amp; tracking</summary>
                <div style={{ paddingTop: 12 }}>
                  <ActionForm action={courierAction} idempotencyKey={randomUUID()} submitLabel="Save courier details" variant="default">
                    <input type="hidden" name="orderId" value={order.id} />
                    <div className="adm-fields">
                      <Field name="courier" label="Courier"><input type="text" name="courier" defaultValue={order.courier} list="adm-couriers" /></Field>
                      <Field name="trackingReference" label="Tracking ref"><input type="text" name="trackingReference" defaultValue={order.trackingReference} /></Field>
                    </div>
                  </ActionForm>
                </div>
              </details>
            ) : null}
          </Card>

          <Card title="Items" description="Snapshot taken at checkout. Later catalogue edits do not change this order.">
            <div className="adm-table-wrap">
              <table className="adm-table" data-stack>
                <thead><tr><th>Item</th><th className="num">Unit</th><th className="num">Qty</th><th className="num">Line</th></tr></thead>
                <tbody>
                  {order.lines.map((line, index) => (
                    <tr key={`${line.sku}-${index}`}>
                      <td className="primary" data-label="Item">{line.title}<span className="sub adm-mono">{line.sku} · {line.format}{line.isbn ? ` · ${line.isbn}` : ""}</span></td>
                      <td className="num" data-label="Unit"><Money pesewas={line.unitPricePesewas} /></td>
                      <td className="num" data-label="Qty">{line.quantity}</td>
                      <td className="num" data-label="Line"><Money pesewas={line.lineTotalPesewas} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="adm-dl" style={{ marginTop: 14, maxWidth: 360, marginLeft: "auto" }}>
              <dt>Subtotal</dt><dd className="adm-money" style={{ textAlign: "right" }}><Money pesewas={order.subtotalPesewas} /></dd>
              <dt>Delivery ({order.delivery.serviceLevel}, rate v{order.delivery.rateVersion})</dt><dd style={{ textAlign: "right" }}><Money pesewas={order.delivery.pricePesewas} /></dd>
              {order.discountPesewas ? <><dt>Discount{order.promotionCode ? ` (${order.promotionCode})` : ""}</dt><dd style={{ textAlign: "right" }}>−<Money pesewas={order.discountPesewas} /></dd></> : null}
              <dt><strong>Total</strong></dt><dd style={{ textAlign: "right" }}><strong><Money pesewas={order.totalPesewas} /></strong></dd>
            </dl>
          </Card>

          <Card title="History">
            <ol className="adm-timeline">
              {order.fulfilmentHistory.map((event, index) => (
                <li key={index}>
                  <strong>{event.from ? `${FULFILMENT_LABELS[event.from]} → ` : ""}{FULFILMENT_LABELS[event.to]}</strong>
                  <span>{event.actorName} · {formatDateTime(event.at)}{event.note ? ` · “${event.note}”` : ""}</span>
                </li>
              ))}
              {order.paidAt ? <li><strong>Payment verified</strong><span>{formatDateTime(order.paidAt)}</span></li> : null}
              {order.dispatchedAt ? <li><strong>Dispatched with {order.courier}</strong><span>{formatDateTime(order.dispatchedAt)}{order.trackingReference ? ` · ${order.trackingReference}` : ""}</span></li> : null}
              {order.deliveredAt ? <li><strong>Delivered</strong><span>{formatDateTime(order.deliveredAt)}{order.deliveryProofNote ? ` · ${order.deliveryProofNote}` : ""}</span></li> : null}
            </ol>
          </Card>

          <Card title="Staff notes" description="Internal only; never shown to the customer.">
            {order.staffNotes.length ? (
              <ol className="adm-timeline" style={{ marginBottom: 12 }}>
                {order.staffNotes.map((note) => <li key={note.id}><strong>{note.body}</strong><span>{note.actorName} · {formatDateTime(note.at)}</span></li>)}
              </ol>
            ) : <p className="adm-muted adm-small">No notes yet.</p>}
            {can(ctx, "orders.fulfil") || can(ctx, "customers.view") ? (
              <ActionForm action={noteAction} idempotencyKey={randomUUID()} submitLabel="Add note" variant="default" resetOnSuccess>
                <input type="hidden" name="orderId" value={order.id} />
                <Field name="body" label="New note"><textarea name="body" rows={2} maxLength={1000} required /></Field>
              </ActionForm>
            ) : null}
          </Card>
        </div>

        <div className="adm-stack">
          <Card title="Customer & delivery">
            <dl className="adm-dl">
              <dt>Name</dt><dd>{order.customer.name}</dd>
              <dt>Phone</dt><dd>{contactVisible ? <a className="adm-link" href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : order.customer.phone}</dd>
              <dt>Email</dt><dd>{order.customer.email ?? "—"}</dd>
              <dt>Region</dt><dd>{order.address.region}</dd>
              <dt>City/town</dt><dd>{order.address.city}</dd>
              <dt>Address</dt><dd>{order.address.addressLine}</dd>
              {order.address.landmark ? <><dt>Landmark</dt><dd>{order.address.landmark}</dd></> : null}
              {order.address.ghanaPostGps ? <><dt>GhanaPost GPS</dt><dd className="adm-mono">{order.address.ghanaPostGps}</dd></> : null}
              {order.address.notes ? <><dt>Notes</dt><dd>{order.address.notes}</dd></> : null}
              <dt>Service</dt><dd>{order.delivery.serviceLevel} · {order.delivery.estimate}</dd>
              <dt>Courier</dt><dd>{order.courier ?? "—"}{order.trackingReference ? <span className="adm-mono"> · {order.trackingReference}</span> : null}</dd>
            </dl>
            {!contactVisible ? <p className="adm-small adm-muted">Contact details are masked for your role.</p> : null}
          </Card>

          <Card title="Payment" description="Separate from fulfilment.">
            {payment ? (
              <dl className="adm-dl">
                <dt>Provider</dt><dd>{payment.provider === "paystack" ? "Paystack" : `Manual (${payment.manualMethod ?? "—"})`}</dd>
                <dt>Reference</dt><dd className="adm-mono">{payment.reference}</dd>
                <dt>Amount</dt><dd><Money pesewas={payment.amountPesewas} /> {payment.currency}</dd>
                <dt>Provider status</dt><dd>{payment.providerStatus} {payment.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Not verified</Badge>}</dd>
                {payment.approvedAt ? <><dt>Approved</dt><dd>{formatDateTime(payment.approvedAt)}</dd></> : null}
                {payment.verificationHistory.length ? <><dt>Checks</dt><dd>{payment.verificationHistory.map((entry, index) => <span key={index} className="sub">{entry.source}: {entry.status} · {formatDateTime(entry.at)}</span>)}</dd></> : null}
              </dl>
            ) : <p className="adm-muted">No payment record.</p>}
            {payment?.refunds.length ? (
              <>
                <h3 style={{ marginTop: 14 }}>Refunds</h3>
                <ul className="adm-timeline">
                  {payment.refunds.map((refund) => (
                    <li key={refund.id}>
                      <strong><Money pesewas={refund.amountPesewas} /> · {refund.status}</strong>
                      <span>{refund.reason}{refund.providerReference ? ` · ref ${refund.providerReference}` : ""} · {formatDateTime(refund.requestedAt)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {can(ctx, "payments.refund") && settled && refundable > 0 && payment ? (
              <details style={{ marginTop: 12 }}>
                <summary className="adm-link" style={{ cursor: "pointer" }}>Start a refund</summary>
                <div style={{ paddingTop: 12 }}>
                  <ActionForm action={refundAction} idempotencyKey={randomUUID()} submitLabel={payment.provider === "paystack" ? "Request Paystack refund" : "Record manual refund"} variant="danger" confirm={`Refund this order? Up to ${pesewasToDecimal(refundable)} GHS can be refunded. Stock is not moved by a refund; cancel or record a return for that.`}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <div className="adm-fields">
                      <Field name="amount" label="Amount (GH₵)" required><input type="text" name="amount" inputMode="decimal" defaultValue={pesewasToDecimal(refundable)} required /></Field>
                      {payment.provider === "manual" ? <Field name="manualEvidence" label="Money returned ref" required><input type="text" name="manualEvidence" required /></Field> : null}
                      <Field name="reason" label="Reason" required wide><input type="text" name="reason" required maxLength={300} /></Field>
                    </div>
                  </ActionForm>
                </div>
              </details>
            ) : null}
          </Card>

          <Card title="Stock movements">
            {movements.length ? (
              <ul className="adm-timeline">
                {movements.map((movement) => <li key={movement.id}><strong className="adm-mono">{movement.type} {movement.sku}</strong><span>on hand {movement.onHandDelta >= 0 ? "+" : ""}{movement.onHandDelta}, reserved {movement.reservedDelta >= 0 ? "+" : ""}{movement.reservedDelta} · {formatDateTime(movement.createdAt)}</span></li>)}
              </ul>
            ) : <p className="adm-muted adm-small">No ledger entries recorded for this order yet{order.channel === "website" ? " (website reservations are written by shared commerce)" : ""}.</p>}
          </Card>

          <Card title="SMS" actions={<Link className="adm-link adm-small" href={`/admin/notifications?orderId=${order.id}`}>Log →</Link>}>
            {notifications.length ? (
              <ul className="adm-timeline">
                {notifications.map((record) => <li key={record.id}><strong>{record.event.replace(/_/g, " ")} · {record.status}</strong><span>{record.recipient} · attempts {record.attempts}{record.mnotifyCampaignId ? ` · campaign ${record.mnotifyCampaignId}` : ""}{record.lastError ? ` · ${record.lastError}` : ""}</span></li>)}
              </ul>
            ) : <p className="adm-muted adm-small">No messages queued.</p>}
          </Card>

          {can(ctx, "audit.view") ? (
            <Card title="Audit">
              {audit.length ? (
                <ul className="adm-timeline">
                  {audit.map((event) => <li key={event.id}><strong>{event.summary}</strong><span>{event.actorName} · {formatDateTime(event.at)}{event.reason ? ` · ${event.reason}` : ""}</span></li>)}
                </ul>
              ) : <p className="adm-muted adm-small">No staff actions yet.</p>}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
