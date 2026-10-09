import { availableOf } from "@/lib/admin/ops/inventory";
import type { AdminDataStore } from "@/lib/admin/store/types";
import { AGE_BANDS, type AgeBand, type Book, type BookVariant as AdminVariant, type InventoryRecord } from "@/lib/admin/types";
import { BUNDLE_CONDITIONS, optionLabel, type BookVariant, type PublicBook, type PublicCategory } from "@/lib/contracts/catalog";
import { RECOMMENDED_CATEGORIES } from "@/lib/admin/recommended-categories";

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
};

function toPublicVariant(variant: AdminVariant, inventory: InventoryRecord | undefined, labelBySku: Map<string, string> = new Map()): BookVariant {
  const condition = variant.condition ?? "new";
  return {
    sku: variant.sku,
    format: variant.format,
    condition,
    ...(condition === "preloved" && variant.conditionGrade ? { conditionGrade: variant.conditionGrade } : {}),
    ...(condition === "preloved" && variant.conditionNote ? { conditionNote: variant.conditionNote } : {}),
    label: optionLabel(variant.format, condition, variant.conditionGrade),
    pricePesewas: variant.pricePesewas,
    ...(variant.compareAtPesewas && variant.compareAtPesewas > variant.pricePesewas ? { compareAtPesewas: variant.compareAtPesewas } : {}),
    ...(variant.format === "Bundle" && variant.bundleItems?.length
      ? { bundleItems: variant.bundleItems.map((item) => ({ title: item.title, quantity: item.quantity, ...(item.sku && labelBySku.has(item.sku) ? { detail: labelBySku.get(item.sku) } : {}) })) }
      : {}),
    available: inventory ? Math.max(0, availableOf(inventory)) : 0,
    ...(variant.isbn ? { isbn: variant.isbn } : {}),
  };
}

export function toPublicBook(book: Book, variants: AdminVariant[], inventory: Map<string, InventoryRecord>, categorySlugs: Map<string, string>, labelBySku: Map<string, string> = new Map()): PublicBook | null {
  if (book.status !== "published" || !(AGE_BANDS as readonly string[]).includes(book.ageBand)) return null;
  const sellable = variants
    .filter((variant) => variant.bookId === book.id && variant.active && variant.pricePesewas > 0)
    .map((variant) => toPublicVariant(variant, inventory.get(variant.sku), labelBySku))
    .sort((left, right) => left.pricePesewas - right.pricePesewas);
  if (!sellable.length) return null;
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.authors.join(", "),
    categories: book.categoryIds.flatMap((id) => categorySlugs.has(id) ? [categorySlugs.get(id)!] : []),
    label: AGE_LABELS[book.ageBand] ?? "",
    description: book.description,
    ...(book.cover ? { coverImageUrl: book.cover.url, coverAlt: book.cover.alt } : {}),
    variant: sellable.find((variant) => variant.available > 0) ?? sellable[0],
    variants: sellable,
    conditions: BUNDLE_CONDITIONS.filter((condition) => sellable.some((variant) => variant.condition === condition)),
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
  const slugById = new Map(categories.filter((category) => category.published).map((category) => [category.id, category.slug]));
  // "Paperback · Preloved · Very good" for each SKU, so bundle contents can say what each item is.
  const labelBySku = new Map(variants.map((variant) => [variant.sku, optionLabel(variant.format, variant.condition, variant.conditionGrade)]));
  return books
    .flatMap((book) => toPublicBook(book, variants, inventoryBySku, slugById, labelBySku) ?? [])
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

/**
 * Shop shelves for the homepage, shop filters and footer, in admin order.
 * Only categories marked visible are shown. Until any category exists in the
 * admin, the recommended shelves are shown so the site is never blank.
 */
export async function loadPublicCategories(store: AdminDataStore): Promise<PublicCategory[]> {
  const categories = await store.query("categories", { orderBy: { field: "order", direction: "asc" } });
  if (!categories.length) return RECOMMENDED_CATEGORIES.map(({ slug, name, caption }) => ({ slug, name, caption }));
  return categories.filter((category) => category.published).map((category) => ({ slug: category.slug, name: category.name, ...(category.caption ? { caption: category.caption } : {}) }));
}
