"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/components/storefront/cart-context";
import type { CheckoutQuote } from "@/lib/commerce/checkout";
import { formatGhs } from "@/lib/contracts/catalog";
import { quoteAction, startCheckoutAction } from "./actions";

type Field = "name" | "phone" | "email" | "region" | "city" | "addressLine" | "ghanaPostGps" | "landmark" | "notes";

export function CheckoutForm({ regions }: { regions: string[] }) {
  const { lines, loaded } = useCart();
  const [values, setValues] = useState<Record<Field, string>>({ name: "", phone: "", email: "", region: "", city: "", addressLine: "", ghanaPostGps: "", landmark: "", notes: "" });
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [rateId, setRateId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const request = useRef(0);

  const refreshQuote = useCallback(async (region: string, city: string) => {
    const id = ++request.current;
    setQuoting(true);
    const result = await quoteAction({ lines, region, city });
    if (id !== request.current) return;
    setQuoting(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setQuote(result.quote);
    setRateId((current) => result.quote.options.some((option) => option.rateId === current) ? current : result.quote.options[0]?.rateId ?? "");
  }, [lines]);

  // Re-price when the bag or region changes; the city is re-checked when the field loses focus.
  useEffect(() => {
    if (loaded) void refreshQuote(values.region, values.city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, lines, values.region, refreshQuote]);

  const set = (field: Field) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const error = (field: string) => fieldErrors[field] ? <small className="field-error">{fieldErrors[field]}</small> : null;

  const cart = quote?.cart;
  const option = quote?.options.find((item) => item.rateId === rateId);
  const total = cart && option ? cart.subtotalPesewas + option.pricePesewas : null;
  const destinationReady = Boolean(values.region && values.city.trim());
  const blocked = !cart || cart.lines.length === 0 || cart.problems.length > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart || !option || total === null) return;
    setSubmitting(true);
    setMessage(null);
    setFieldErrors({});
    const result = await startCheckoutAction({
      lines,
      customer: { name: values.name, phone: values.phone, email: values.email || undefined },
      address: { region: values.region, city: values.city, addressLine: values.addressLine, ghanaPostGps: values.ghanaPostGps || undefined, landmark: values.landmark || undefined, notes: values.notes || undefined },
      deliveryRateId: option.rateId,
      expectedTotalPesewas: total,
    });
    if (result.ok) {
      window.location.assign(result.authorizationUrl);
      return;
    }
    setSubmitting(false);
    setMessage(result.message);
    setFieldErrors(result.fieldErrors ?? {});
    void refreshQuote(values.region, values.city);
  }

  if (loaded && !lines.length) {
    return <div className="empty-state"><h2>Your bag is empty.</h2><p>Add something from the shop to check out.</p><Link className="button button-dark" href="/shop">Browse the shop ↗</Link></div>;
  }

  return <form className="checkout-layout" onSubmit={onSubmit} noValidate>
    <div className="checkout-form">
      <section><h2>1. Your details</h2><div className="form-grid">
        <label>Full name<input name="name" autoComplete="name" required value={values.name} onChange={set("name")} aria-invalid={Boolean(fieldErrors.name)}/>{error("name")}</label>
        <label>Phone number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="024 000 0000" required value={values.phone} onChange={set("phone")} aria-invalid={Boolean(fieldErrors.phone)}/>{error("phone")}<small className="field-hint">For delivery and order support.</small></label>
        <label className="wide">Email (optional)<input name="email" type="email" autoComplete="email" placeholder="For your Paystack receipt" value={values.email} onChange={set("email")} aria-invalid={Boolean(fieldErrors.email)}/>{error("email")}</label>
      </div></section>

      <section><h2>2. Delivery address</h2><div className="form-grid">
        <label>Region<select name="region" required value={values.region} onChange={set("region")} aria-invalid={Boolean(fieldErrors.region)}><option value="">Choose region</option>{regions.map((region) => <option key={region}>{region}</option>)}</select>{error("region")}</label>
        <label>City or town<input name="city" autoComplete="address-level2" required value={values.city} onChange={set("city")} onBlur={() => void refreshQuote(values.region, values.city)} aria-invalid={Boolean(fieldErrors.city)}/>{error("city")}</label>
        <label className="wide">Address or landmark<input name="addressLine" autoComplete="street-address" required placeholder="House number, street, area" value={values.addressLine} onChange={set("addressLine")} aria-invalid={Boolean(fieldErrors.addressLine)}/>{error("addressLine")}</label>
        <label>GhanaPost GPS (optional)<input name="ghanaPostGps" placeholder="AK-000-0000" value={values.ghanaPostGps} onChange={set("ghanaPostGps")}/></label>
        <label>Nearby landmark (optional)<input name="landmark" value={values.landmark} onChange={set("landmark")}/></label>
        <label className="wide">Delivery notes (optional)<textarea name="notes" rows={2} value={values.notes} onChange={set("notes")}/></label>
      </div></section>

      <section><h2>3. Delivery option</h2>
        {!destinationReady ? <p className="form-help">Choose your region and enter your town to see delivery prices.</p>
          : quoting && !quote?.options.length ? <p className="form-help">Checking delivery…</p>
          : quote?.options.length ? <div className="delivery-options">{quote.options.map((item) => <label key={item.rateId} className="delivery-option" data-selected={item.rateId === rateId || undefined}>
              <input type="radio" name="delivery" value={item.rateId} checked={item.rateId === rateId} onChange={() => setRateId(item.rateId)}/>
              <span><strong>{item.label}</strong><small>{item.estimate}</small></span><b>{formatGhs(item.pricePesewas)}</b>
            </label>)}</div>
          : <p className="form-help form-help-warn">We don’t have an online delivery price for {values.city.trim() || "this town"} yet. Message us on WhatsApp and we’ll arrange it.</p>}
        {error("delivery")}
      </section>
    </div>

    <aside className="order-summary">
      <h2>Your order</h2>
      {!cart ? <p className="summary-placeholder">Loading your bag…</p> : <>
        <ul className="summary-lines">{cart.lines.map((line) => <li key={line.sku}><span>{line.quantity} × {line.title} <small>{line.format}</small></span><strong>{formatGhs(line.lineTotalPesewas)}</strong></li>)}</ul>
        {cart.problems.length ? <div className="cart-alert">{cart.problems.map((problem) => <p key={problem}>{problem}</p>)}<Link href="/cart">Update your bag</Link></div> : null}
        <div><span>Items</span><strong>{formatGhs(cart.subtotalPesewas)}</strong></div>
        <div><span>Delivery</span>{option ? <strong>{formatGhs(option.pricePesewas)}</strong> : <span>—</span>}</div>
        <div className="summary-total"><span>Total</span><strong>{total !== null ? formatGhs(total) : "—"}</strong></div>
      </>}
      {message ? <p className="checkout-error" role="alert">{message}</p> : null}
      <button className="button button-dark summary-button" type="submit" disabled={blocked || !option || submitting || quoting}>{submitting ? "Connecting to Paystack…" : total !== null ? `Pay ${formatGhs(total)}` : "Pay"}</button>
      <p className="summary-small">You’ll be taken to Paystack to pay with Mobile Money or card. By paying you agree to our <Link href="/terms">Terms</Link> and <Link href="/returns">Returns policy</Link>.</p>
      <Link className="checkout-back" href="/cart">← Back to your bag</Link>
    </aside>
  </form>;
}
