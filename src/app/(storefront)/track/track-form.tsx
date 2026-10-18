"use client";

import { useActionState } from "react";
import { formatGhs } from "@/lib/contracts/catalog";
import type { FulfilmentStatus } from "@/lib/admin/types";
import type { TrackedOrder } from "@/lib/storefront/order-tracking";
import { trackOrderAction, type TrackState } from "./actions";

const STEPS: { status: FulfilmentStatus; label: string; detail: string }[] = [
  { status: "new", label: "Order received", detail: "We have your order." },
  { status: "picking", label: "Being prepared", detail: "We’re picking your items." },
  { status: "packed", label: "Packed", detail: "Your parcel is ready to go." },
  { status: "dispatched", label: "On its way", detail: "With the delivery person." },
  { status: "delivered", label: "Delivered", detail: "Enjoy!" },
];

const SPECIAL: Partial<Record<FulfilmentStatus, { title: string; body: string }>> = {
  cancelled: { title: "This order was cancelled", body: "If you paid, you’ll get your money back as our Returns & Refunds page explains. Message us on WhatsApp if you have questions." },
  returned: { title: "This order was returned", body: "This order came back to us. Message us on WhatsApp if you have questions about your refund." },
  exception: { title: "We need to check something", body: "There’s a problem with this order and we’re looking into it. We’ll contact you, or you can message us on WhatsApp." },
};

const PAYMENT_LABELS: Record<TrackedOrder["paymentStatus"], string> = {
  awaiting_payment: "Waiting for payment",
  paid: "Paid",
  payment_failed: "Payment not completed",
  refunded: "Refunded",
};

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(iso));
}

function OrderStatus({ order }: { order: TrackedOrder }) {
  const reachedAt = new Map<FulfilmentStatus, string>();
  for (const event of order.timeline) reachedAt.set(event.status, event.at);
  if (!reachedAt.has("new")) reachedAt.set("new", order.placedAt);
  const currentIndex = STEPS.findIndex((step) => step.status === order.fulfilmentStatus);
  const special = SPECIAL[order.fulfilmentStatus];

  return <section className="track-result" aria-live="polite" aria-labelledby="track-result-heading">
    <div className="track-result-head">
      <div><p className="eyebrow">Order {order.ref}</p><h2 id="track-result-heading">{special ? special.title : STEPS[Math.max(currentIndex, 0)].label}</h2></div>
      <span className="track-pill" data-status={order.paymentStatus}>{PAYMENT_LABELS[order.paymentStatus]}</span>
    </div>
    {special
      ? <p className="track-special">{special.body}</p>
      : <ol className="track-steps">{STEPS.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          const at = reachedAt.get(step.status);
          return <li key={step.status} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="track-dot" aria-hidden="true"/>
            <div><strong>{step.label}</strong><span>{state === "upcoming" ? step.detail : at ? formatWhen(at) : step.detail}</span></div>
          </li>;
        })}</ol>}
    <dl className="track-details">
      <div><dt>Placed</dt><dd>{formatWhen(order.placedAt)}</dd></div>
      <div><dt>Delivering to</dt><dd>{order.destination || "—"}</dd></div>
      <div><dt>Estimated delivery</dt><dd>{order.estimate || "—"}</dd></div>
      {order.courier ? <div><dt>Courier</dt><dd>{order.courier}</dd></div> : null}
      {order.trackingReference ? <div><dt>Delivery tracking number</dt><dd>{order.trackingReference}</dd></div> : null}
      <div><dt>Total</dt><dd>{formatGhs(order.totalPesewas)}</dd></div>
    </dl>
    <ul className="track-items">{order.items.map((item, index) => <li key={`${item.title}-${index}`}><span>{item.quantity} ×</span> {item.title} <small>{item.format}</small></li>)}</ul>
  </section>;
}

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrderAction, { status: "idle" });
  return <>
    <form className="track-form" action={action}>
      <label><span>Order number</span><input name="ref" required defaultValue={state.status === "error" ? state.ref : undefined} key={state.status === "error" ? `ref-${state.message}-${state.ref}` : "ref"} placeholder="BD-XXXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20}/></label>
      <label><span>Phone number used for the order</span><input name="phone" type="tel" required placeholder="024 000 0000" autoComplete="tel" inputMode="tel" maxLength={20}/></label>
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Checking…" : "Track order"}</button>
      <div aria-live="polite">{state.status === "error" ? <p className="track-error">{state.message}</p> : null}</div>
    </form>
    {state.status === "found" ? <OrderStatus order={state.order}/> : null}
  </>;
}
