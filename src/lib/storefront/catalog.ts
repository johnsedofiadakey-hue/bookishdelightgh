import { availableOf } from "@/lib/admin/ops/inventory";
import type { AdminDataStore } from "@/lib/admin/store/types";
import type { AgeBand, Book, BookVariant as AdminVariant, InventoryRecord } from "@/lib/admin/types";
import type { BookVariant, PublicBook } from "@/lib/contracts/catalog";

/**
 * Public catalogue read from the admin data store.
 *
 * Only `published` books with at least one active, priced variant are shown.
 * Availability is on-hand minus reserved. Cost prices, weights, staff fields
 * and draft content never leave this module.
 */

const AGE_LABELS: Record<AgeBand, string> = {
  "0-3": "Ages 0–3",
  "4-7": "Ages 4–7",
  "8-12": "Ages 8–12",
  "13-17": "Ages 13–17",
  adult: "Adults",
  "all-ages": "All ages",
};

function toPublicVariant(variant: AdminVariant, inventory: InventoryRecord | undefined): BookVariant {
  return {
    sku: variant.sku,
    format: variant.format,
    pricePesewas: variant.pricePesewas,
    available: inventory ? Math.max(0, availableOf(inventory)) : 0,
    ...(variant.isbn ? { isbn: variant.isbn } : {}),
  };
}

export function toPublicBook(book: Book, variants: AdminVariant[], inventory: Map<string, InventoryRecord>, categorySlugs: Map<string, string>): PublicBook | null {
  if (book.status !== "published") return null;
  const sellable = variants
    .filter((variant) => variant.bookId === book.id && variant.active && variant.pricePesewas > 0)
    .map((variant) => toPublicVariant(variant, inventory.get(variant.sku)))
    .sort((left, right) => left.pricePesewas - right.pricePesewas);
  if (!sellable.length) return null;
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.authors.join(", "),
    categories: book.categoryIds.map((id) => categorySlugs.get(id) ?? id),
    label: AGE_LABELS[book.ageBand] ?? "",
    description: book.description,
    ...(book.cover ? { coverImageUrl: book.cover.url, coverAlt: book.cover.alt } : {}),
    variant: sellable.find((variant) => variant.available > 0) ?? sellable[0],
    variants: sellable,
  };
}

export async function loadPublicCatalog(store: AdminDataStore): Promise<PublicBook[]> {
  const [books, variants, inventory, categories] = await Promise.all([
    store.query("books", { where: [["status", "==", "published"]] }),
    store.query("bookVariants", { where: [["active", "==", true]] }),
    store.query("inventory"),
    store.query("categories"),
  ]);
  const inventoryBySku = new Map(inventory.map((record) => [record.sku, record]));
  const slugById = new Map(categories.map((category) => [category.id, category.slug]));
  return books
    .flatMap((book) => toPublicBook(book, variants, inventoryBySku, slugById) ?? [])
    .sort((left, right) => Number(right.variant.available > 0) - Number(left.variant.available > 0) || left.title.localeCompare(right.title));
}

/** Find the public book and variant for a SKU, from an already loaded catalogue. */
export function findVariant(catalog: PublicBook[], sku: string): { book: PublicBook; variant: BookVariant } | null {
  for (const book of catalog) {
    const variant = book.variants.find((item) => item.sku === sku);
    if (variant) return { book, variant };
  }
  return null;
}
