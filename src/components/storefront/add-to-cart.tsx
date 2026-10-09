"use client";

import { useState } from "react";
import { useCart } from "@/components/storefront/cart-context";

export function AddToCart({ sku, compact = false }: { sku: string; compact?: boolean }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return <button className={compact ? "add-circle" : "button button-dark add-button"} type="button" onClick={() => { add(sku); setAdded(true); window.setTimeout(() => setAdded(false), 1600); }} aria-label={compact ? "Add book to bag" : undefined}>{compact ? "+" : added ? "Added to bag ✓" : "Add to bag"}</button>;
}
