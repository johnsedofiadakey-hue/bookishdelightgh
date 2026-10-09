"use client";

import { useState } from "react";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { formatGhs, type BookVariant } from "@/lib/contracts/catalog";

export function VariantPicker({ variants, initialSku }: { variants: BookVariant[]; initialSku: string }) {
  const [sku, setSku] = useState(initialSku);
  const selected = variants.find((variant) => variant.sku === sku) ?? variants[0];
  return <div className="variant-picker">
    <p className="detail-price">{formatGhs(selected.pricePesewas)}</p>
    {variants.length > 1 ? <fieldset className="variant-options"><legend>Choose a format</legend>{variants.map((variant) => <label key={variant.sku} data-selected={variant.sku === selected.sku || undefined}>
      <input type="radio" name="variant" value={variant.sku} checked={variant.sku === selected.sku} onChange={() => setSku(variant.sku)}/>
      <span>{variant.format}</span><small>{formatGhs(variant.pricePesewas)}{variant.available < 1 ? " · Out of stock" : ""}</small>
    </label>)}</fieldset> : null}
    <dl className="detail-facts"><div><dt>Format</dt><dd>{selected.format}</dd></div><div><dt>Availability</dt><dd>{selected.available < 1 ? "Out of stock" : selected.available <= 3 ? `Only ${selected.available} left` : "In stock"}</dd></div>{selected.isbn ? <div><dt>ISBN</dt><dd>{selected.isbn}</dd></div> : null}<div><dt>Delivery</dt><dd>Price shown at checkout for your town</dd></div></dl>
    <AddToCart sku={selected.sku} available={selected.available} key={selected.sku}/>
  </div>;
}
