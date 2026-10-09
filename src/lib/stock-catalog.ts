import type { PublicBook } from "@/lib/contracts/catalog";

/** Public catalogue stays empty until verified Bookish Delight stock is connected. */
export const stockBooks: PublicBook[] = [];

export function getStockBooks(): PublicBook[] {
  return stockBooks;
}
