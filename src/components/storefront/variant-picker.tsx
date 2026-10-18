"use client";

import { useState } from "react";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { conditionLabel, formatGhs, GRADE_DESCRIPTIONS, savingPesewas, type BookVariant } from "@/lib/contracts/catalog";

export function VariantPicker({ variants, initialSku }: { variants: BookVariant[]; initialSku: string }) {
  const [sku, setSku] = useState(initialSku);
  const selected = variants.find((variant) => variant.sku === sku) ?? variants[0];
  return <div className="variant-picker">
    <p className="detail-price">{formatGhs(selected.pricePesewas)}{savingPesewas(selected) ? <span className="detail-saving"> <s>{formatGhs(selected.compareAtPesewas!)}</s> You save {formatGhs(savingPesewas(selected))}</span> : null}</p>
    {variants.length > 1 ? <fieldset className="variant-options"><legend>Choose an option</legend>{variants.map((variant) => <label key={variant.sku} data-selected={variant.sku === selected.sku || undefined}>
      <input type="radio" name="variant" value={variant.sku} checked={variant.sku === selected.sku} onChange={() => setSku(variant.sku)}/>
      <span>{variant.label}</span><small>{formatGhs(variant.pricePesewas)}{savingPesewas(variant) ? ` · save ${formatGhs(savingPesewas(variant))}` : ""}{variant.available < 1 ? " · Out of stock" : ""}</small>
    </label>)}</fieldset> : null}
    <dl className="detail-facts"><div><dt>Format</dt><dd>{selected.format}</dd></div><div><dt>Condition</dt><dd>{conditionLabel(selected.condition, selected.conditionGrade)}{selected.condition === "preloved" ? <small className="condition-detail">{selected.conditionGrade ? GRADE_DESCRIPTIONS[selected.conditionGrade] : null}{selected.conditionNote ? ` ${selected.conditionNote}` : null}</small> : null}</dd></div><div><dt>Availability</dt><dd>{selected.available < 1 ? "Out of stock" : selected.available <= 3 ? `Only ${selected.available} left` : "In stock"}</dd></div>{selected.isbn ? <div><dt>ISBN</dt><dd>{selected.isbn}</dd></div> : null}<div><dt>Delivery</dt><dd>Price shown at checkout for your town</dd></div></dl>
    {selected.bundleItems?.length ? <div className="bundle-contents"><h2>What’s inside</h2><ul>{selected.bundleItems.map((item, index) => <li key={`${item.title}-${index}`}><span>{item.quantity} ×</span> {item.title}{item.detail ? <small>{item.detail}</small> : null}</li>)}</ul></div> : null}
    <AddToCart sku={selected.sku} available={selected.available} key={selected.sku}/>
  </div>;
}
