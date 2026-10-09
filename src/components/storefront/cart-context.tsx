"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { stockBooks } from "@/lib/stock-catalog";

export interface CartLine {
  sku: string;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  add: (sku: string) => void;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = "bookish-delight-preview-cart";

function safeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((line) => {
    if (!line || typeof line.sku !== "string" || !Number.isInteger(line.quantity)) return [];
    const book = stockBooks.find((item) => item.variant.sku === line.sku);
    if (!book || line.quantity < 1) return [];
    return [{ sku: line.sku, quantity: Math.min(line.quantity, book.variant.available) }];
  });
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
    if (loaded) localStorage.setItem(storageKey, JSON.stringify(lines));
  }, [lines, loaded]);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    add(sku) {
      const max = stockBooks.find((book) => book.variant.sku === sku)?.variant.available ?? 0;
      if (!max) return;
      setLines((current) => {
        const existing = current.find((line) => line.sku === sku);
        if (!existing) return [...current, { sku, quantity: 1 }];
        return current.map((line) => line.sku === sku ? { ...line, quantity: Math.min(line.quantity + 1, max) } : line);
      });
    },
    setQuantity(sku, quantity) {
      const max = stockBooks.find((book) => book.variant.sku === sku)?.variant.available ?? 0;
      setLines((current) => current.flatMap((line) => {
        if (line.sku !== sku) return [line];
        if (quantity <= 0 || !max) return [];
        return [{ sku, quantity: Math.min(Math.floor(quantity), max) }];
      }));
    },
    remove(sku) {
      setLines((current) => current.filter((line) => line.sku !== sku));
    },
  }), [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("CartProvider is missing");
  return context;
}
