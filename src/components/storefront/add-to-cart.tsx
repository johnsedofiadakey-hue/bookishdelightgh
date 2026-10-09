"use client";

import { useState } from "react";
import { useCart } from "@/components/storefront/cart-context";

export function AddToCart({ sku, available, compact = false }: { sku: string; available: number; compact?: boolean }) {
  const { add, lines } = useCart();
  const [added, setAdded] = useState(false);
  const inBag = lines.find((line) => line.sku === sku)?.quantity ?? 0;
  const soldOut = available < 1;
  const atLimit = !soldOut && inBag >= available;
  const label = soldOut ? "Out of stock" : atLimit ? "All available in bag" : added ? "Added to bag ✓" : "Add to bag";
  return <button
    className={compact ? "add-circle" : "button button-dark add-button"}
    type="button"
    disabled={soldOut || atLimit}
    onClick={() => { add(sku, available); setAdded(true); window.setTimeout(() => setAdded(false), 1600); }}
    aria-label={compact ? (soldOut ? "Out of stock" : "Add to bag") : undefined}
  >{compact ? (soldOut ? "–" : "+") : label}</button>;
}
