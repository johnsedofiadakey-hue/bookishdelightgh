"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartLine {
  sku: string;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  loaded: boolean;
  /** Adds one, never beyond `max` (the available stock shown on the page). */
  add: (sku: string, max: number) => void;
  setQuantity: (sku: string, quantity: number, max: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = "bookish-delight-cart";
const MAX_LINE_QUANTITY = 50;

/** Shape-checks stored lines. Prices and stock are always rechecked on the server. */
function safeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((line) => {
    if (!line || typeof line.sku !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(line.sku) || !Number.isInteger(line.quantity) || line.quantity < 1 || seen.has(line.sku)) return [];
    seen.add(line.sku);
    return [{ sku: line.sku, quantity: Math.min(line.quantity, MAX_LINE_QUANTITY) }];
  }).slice(0, 40);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setLines(safeLines(JSON.parse(localStorage.getItem(storageKey) || "[]")));
    } catch {
      setLines([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      // Storage can be unavailable (private mode); the bag still works for this visit.
    }
  }, [lines, loaded]);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    loaded,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    add(sku, max) {
      const limit = Math.min(max, MAX_LINE_QUANTITY);
      if (limit < 1) return;
      setLines((current) => {
        const existing = current.find((line) => line.sku === sku);
        if (!existing) return [...current, { sku, quantity: 1 }];
        return current.map((line) => line.sku === sku ? { ...line, quantity: Math.min(line.quantity + 1, limit) } : line);
      });
    },
    setQuantity(sku, quantity, max) {
      const limit = Math.min(max, MAX_LINE_QUANTITY);
      setLines((current) => current.flatMap((line) => {
        if (line.sku !== sku) return [line];
        if (quantity <= 0 || limit < 1) return [];
        return [{ sku, quantity: Math.min(Math.floor(quantity), limit) }];
      }));
    },
    remove(sku) {
      setLines((current) => current.filter((line) => line.sku !== sku));
    },
    clear() {
      setLines([]);
    },
  }), [lines, loaded]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("CartProvider is missing");
  return context;
}
