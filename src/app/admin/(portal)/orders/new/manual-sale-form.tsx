"use client";

import { useMemo, useState } from "react";
import { ActionForm, Field, FieldErrorFor } from "@/components/admin/action-form";
import type { ActionState } from "@/lib/admin/action-state";
import { GHANA_REGIONS } from "@/lib/admin/validation";

export interface SaleVariant {
  sku: string;
  label: string;
  pricePesewas: number;
  weightGrams: number;
  available: number;
}

export interface SaleRate {
  id: string;
  name: string;
  region: string;
  cities: string[];
  pricePesewas: number;
  minWeightGrams: number;
  maxWeightGrams: number;
  minOrderPesewas: number;
  estimate: string;
}

const ghs = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const format = (pesewas: number) => ghs.format(pesewas / 100);
const decimal = (pesewas: number) => `${Math.floor(pesewas / 100)}.${String(pesewas % 100).padStart(2, "0")}`;

export function ManualSaleForm({ action, idempotencyKey, variants, rates, canApprove }: { action: (state: ActionState, form: FormData) => Promise<ActionState>; idempotencyKey: string; variants: SaleVariant[]; rates: SaleRate[]; canApprove: boolean }) {
  const [lines, setLines] = useState<{ id: number; sku: string; quantity: number }[]>([{ id: 1, sku: "", quantity: 1 }]);
  const [region, setRegion] = useState("Greater Accra");
  const [city, setCity] = useState("");
  const [rateId, setRateId] = useState("pickup");
  const bySku = useMemo(() => new Map(variants.map((variant) => [variant.sku, variant])), [variants]);

  const subtotal = lines.reduce((sum, line) => sum + (bySku.get(line.sku)?.pricePesewas ?? 0) * line.quantity, 0);
  const weight = lines.reduce((sum, line) => sum + (bySku.get(line.sku)?.weightGrams ?? 0) * line.quantity, 0);
  const matchingRates = rates.filter((rate) => rate.region === region && weight >= rate.minWeightGrams && weight <= rate.maxWeightGrams && subtotal >= rate.minOrderPesewas && (rate.cities.length === 0 || rate.cities.some((name) => name.toLowerCase() === city.trim().toLowerCase())));
  const selectedRate = matchingRates.find((rate) => rate.id === rateId);
  const effectiveRateId = rateId === "pickup" || selectedRate ? rateId : "pickup";
  const deliveryPrice = selectedRate && effectiveRateId === rateId ? selectedRate.pricePesewas : 0;
  const total = subtotal + deliveryPrice;

  return (
    <ActionForm action={action} idempotencyKey={idempotencyKey} submitLabel={canApprove ? "Save paid sale" : "Save and send for approval"} variant="coral" pendingLabel="Saving…">
      <section className="adm-card">
        <div className="adm-card-head"><div><h2>Books</h2><p>Prices come from your product list. You can only sell what’s in stock.</p></div></div>
        <div className="adm-stack">
          {lines.map((line, index) => {
            const variant = bySku.get(line.sku);
            const usedElsewhere = new Set(lines.filter((other) => other.id !== line.id).map((other) => other.sku));
            return (
              <div className="adm-fields adm-fields-4" key={line.id} style={{ alignItems: "end" }}>
                <label className="adm-field" style={{ gridColumn: "span 2" }}>
                  <span>Book {index + 1}</span>
                  <select name="lineSku" value={line.sku} onChange={(event) => setLines((all) => all.map((item) => (item.id === line.id ? { ...item, sku: event.target.value, quantity: 1 } : item)))} required>
                    <option value="">Choose an item…</option>
                    {variants.map((option) => (
                      <option key={option.sku} value={option.sku} disabled={usedElsewhere.has(option.sku)}>
                        {option.label} — {format(option.pricePesewas)} ({option.available} available)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="adm-field">
                  <span>Quantity</span>
                  <input type="number" name="lineQty" min={1} max={variant?.available ?? 1} value={line.quantity} onChange={(event) => setLines((all) => all.map((item) => (item.id === line.id ? { ...item, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : item)))} />
                </label>
                <div className="adm-field">
                  <span className="adm-small adm-muted">{variant ? format(variant.pricePesewas * line.quantity) : "—"}</span>
                  {lines.length > 1 ? <button className="adm-btn" data-size="sm" data-variant="ghost" type="button" onClick={() => setLines((all) => all.filter((item) => item.id !== line.id))}>Remove</button> : null}
                </div>
                {variant && line.quantity > variant.available ? <p className="adm-field-error wide">Only {variant.available} available.</p> : null}
              </div>
            );
          })}
          <div>
            <button className="adm-btn" data-size="sm" type="button" onClick={() => setLines((all) => [...all, { id: Math.max(...all.map((item) => item.id)) + 1, sku: "", quantity: 1 }])}>+ Add another item</button>
          </div>
          <FieldErrorFor name="lines" />
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><div><h2>Customer</h2></div></div>
        <div className="adm-fields adm-fields-3">
          <Field name="manualChannel" label="Where was it sold?" required>
            <select name="manualChannel" defaultValue="instagram">
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone</option>
              <option value="walk_in">In person / event</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field name="name" label="Customer name" required><input type="text" name="name" required autoComplete="off" /></Field>
          <Field name="phone" label="Phone" required><input type="tel" name="phone" required placeholder="024 000 0000" /></Field>
          <Field name="email" label="Email"><input type="email" name="email" /></Field>
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><div><h2>Delivery</h2><p>Uses your delivery prices. Pick-up is free.</p></div></div>
        <div className="adm-fields adm-fields-3">
          <Field name="region" label="Region" required>
            <select name="region" value={region} onChange={(event) => setRegion(event.target.value)}>
              {GHANA_REGIONS.map((name) => <option key={name}>{name}</option>)}
            </select>
          </Field>
          <Field name="city" label="City / town" required><input type="text" name="city" value={city} onChange={(event) => setCity(event.target.value)} required /></Field>
          <Field name="deliveryRateId" label="Delivery option" required hint={`Parcel weight ≈ ${weight} g`}>
            <select name="deliveryRateId" value={effectiveRateId} onChange={(event) => setRateId(event.target.value)}>
              <option value="pickup">Customer pickup — {format(0)}</option>
              {matchingRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} — {format(rate.pricePesewas)} ({rate.estimate})</option>)}
            </select>
          </Field>
          <Field name="addressLine" label="Address" wide hint="Needed for delivery"><input type="text" name="addressLine" /></Field>
          <Field name="landmark" label="Landmark"><input type="text" name="landmark" /></Field>
          <Field name="ghanaPostGps" label="GhanaPost GPS"><input type="text" name="ghanaPostGps" placeholder="GA-000-0000" /></Field>
          <Field name="notes" label="Delivery notes"><input type="text" name="notes" /></Field>
        </div>
        {!matchingRates.length && region ? <p className="adm-small adm-muted" style={{ marginBottom: 0 }}>There’s no delivery price for {city || "this place"} in {region} at {weight} g. Choose pick-up, or add a price on the Delivery page.</p> : null}
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><div><h2>Payment received</h2><p>{canApprove ? "You can approve payments, so this order will be saved as paid." : "A manager or the owner needs to approve this proof before the order counts as paid."}</p></div></div>
        <div className="adm-fields adm-fields-3">
          <Field name="method" label="How they paid" required>
            <select name="method" defaultValue="momo">
              <option value="momo">Mobile Money</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="pos_card">Card machine</option>
            </select>
          </Field>
          <Field name="evidence" label="Proof of payment" required hint="MoMo transaction ID, bank reference or receipt number"><input type="text" name="evidence" required /></Field>
          <Field name="amount" label="Amount received (GH₵)" required hint={`Order total: ${format(total)}`}>
            <input type="text" name="amount" inputMode="decimal" key={total} defaultValue={total ? decimal(total) : ""} required />
          </Field>
        </div>
        <dl className="adm-dl" style={{ marginTop: 14, maxWidth: 320 }}>
          <dt>Books</dt><dd>{format(subtotal)}</dd>
          <dt>Delivery</dt><dd>{format(deliveryPrice)}</dd>
          <dt><strong>Total</strong></dt><dd><strong>{format(total)}</strong></dd>
        </dl>
        <p className="adm-small adm-muted">We work out the prices and delivery again when you save. If the amount doesn’t match, the sale won’t save.</p>
      </section>
    </ActionForm>
  );
}
