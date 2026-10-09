"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/storefront/cart-context";

/** Empties the bag once, after a confirmed payment. */
export function ClearCart() {
  const { clear, loaded } = useCart();
  const done = useRef(false);
  useEffect(() => {
    if (!loaded || done.current) return;
    done.current = true;
    clear();
  }, [loaded, clear]);
  return null;
}
