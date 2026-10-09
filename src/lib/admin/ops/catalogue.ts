import { pick, recordAudit, stripUndefined } from "@/lib/admin/audit";
import { assertPermission, can, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { newId, nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import { availableOf } from "@/lib/admin/ops/inventory";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";
import {
  AGE_BANDS,
  BOOK_FORMATS,
  SCHEMA_VERSION,
  type AdminBookFormat,
  type AgeBand,
  type Book,
  type BookVariant,
  type BundleItem,
  type Category,
  type ImageRef,
  type InventoryRecord,
  type PublishStatus,
} from "@/lib/admin/types";
import { isValidIsbn, isValidSku, isValidSlug, normalizeIsbn, normalizeSku, slugify } from "@/lib/admin/validation";
import { BUNDLE_CONDITIONS, ITEM_CONDITIONS, optionLabel, PRELOVED_GRADES, type ItemCondition, type PrelovedGrade } from "@/lib/contracts/catalog";

/* ------------------------------------------------------------- Validation */

export interface BookInput {
  title: string;
  subtitle?: string;
  slug?: string;
  authors: string[];
  publisher?: string;
  description: string;
  language: string;
  ageBand: AgeBand;
  categoryIds: string[];
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  relatedBookIds: string[];
}

export function validateBookInput(input: BookInput): { value: BookInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = input.title.trim();
  if (title.length < 1 || title.length > 200) errors.title = "Title is required (max 200 characters).";
  const slug = (input.slug?.trim() || slugify(title)).toLowerCase();
  if (!isValidSlug(slug)) errors.slug = "Use lowercase letters, numbers and hyphens.";
  const authors = input.authors.map((author) => author.trim()).filter(Boolean).slice(0, 10);
  const description = input.description.trim();
  if (description.length > 5000) errors.description = "Keep the description under 5,000 characters.";
  if (!(AGE_BANDS as readonly string[]).includes(input.ageBand)) errors.ageBand = "Choose an age band.";
  const language = input.language.trim() || "English";
  if (input.seoTitle && input.seoTitle.length > 70) errors.seoTitle = "SEO titles should be 70 characters or fewer.";
  if (input.seoDescription && input.seoDescription.length > 170) errors.seoDescription = "SEO descriptions should be 170 characters or fewer.";
  const tags = input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  return {
    value: {
      ...input,
      title,
      subtitle: input.subtitle?.trim() || undefined,
      slug,
      authors,
      publisher: input.publisher?.trim() || undefined,
      description,
      language,
      tags,
      seoTitle: input.seoTitle?.trim() || undefined,
      seoDescription: input.seoDescription?.trim() || undefined,
      categoryIds: [...new Set(input.categoryIds)],
      relatedBookIds: [...new Set(input.relatedBookIds)].slice(0, 12),
    },
    errors,
  };
}

export interface VariantInput {
  sku: string;
  format: AdminBookFormat;
  condition: ItemCondition;
  conditionGrade?: PrelovedGrade;
  conditionNote?: string;
  edition?: string;
  isbn?: string;
  pricePesewas: number;
  costPesewas?: number;
  weightGrams: number;
  active: boolean;
  compareAtPesewas?: number;
  /** Bundles only. */
  bundleItems?: BundleItem[];
  /** Staff confirmed this ISBN+format is a deliberate separate listing. */
  confirmDuplicateIsbn?: boolean;
}

export const MAX_BUNDLE_ITEMS = 30;

function normalizeBundleItems(items: BundleItem[] | undefined, errors: Record<string, string>): BundleItem[] {
  const cleaned = (items ?? [])
    .map((item) => ({ ...(item.sku?.trim() ? { sku: normalizeSku(item.sku) } : {}), title: item.title.trim().slice(0, 120), quantity: item.quantity }))
    .filter((item) => item.sku || item.title);
  if (!cleaned.length) errors.bundleItems = "List what’s inside the bundle.";
  if (cleaned.length > MAX_BUNDLE_ITEMS) errors.bundleItems = `A bundle can list up to ${MAX_BUNDLE_ITEMS} items.`;
  if (cleaned.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) errors.bundleItems = "Each item’s quantity must be 1–20.";
  const skus = cleaned.flatMap((item) => (item.sku ? [item.sku] : []));
  if (new Set(skus).size !== skus.length) errors.bundleItems = "List each stocked SKU once; use the quantity for several copies.";
  return cleaned;
}

export function validateVariantInput(input: VariantInput): { value: VariantInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const sku = normalizeSku(input.sku);
  if (!isValidSku(sku)) errors.sku = "3–40 characters: A–Z, 0–9 and hyphens.";
  if (!(BOOK_FORMATS as readonly string[]).includes(input.format)) errors.format = "Choose a format.";
  const isbn = input.isbn ? normalizeIsbn(input.isbn) : undefined;
  if (isbn && !isValidIsbn(isbn)) errors.isbn = "This ISBN's check digit is invalid.";
  if (!Number.isSafeInteger(input.pricePesewas) || input.pricePesewas < 0 || input.pricePesewas > 10_000_000) errors.pricePesewas = "Enter a price between GH₵0 and GH₵100,000.";
  if (input.costPesewas !== undefined && (!Number.isSafeInteger(input.costPesewas) || input.costPesewas < 0)) errors.costPesewas = "Cost must be a positive amount.";
  if (!Number.isInteger(input.weightGrams) || input.weightGrams < 0 || input.weightGrams > 30_000) errors.weightGrams = "Weight must be 0–30,000 g.";
  const isBundle = input.format === "Bundle";
  const allowed = isBundle ? BUNDLE_CONDITIONS : ITEM_CONDITIONS;
  const condition: ItemCondition = allowed.includes(input.condition) ? input.condition : "new";
  if (!allowed.includes(input.condition)) errors.condition = isBundle ? "Choose Brand new, Preloved or Mixed." : "Choose Brand new or Preloved. Mixed is for bundles only.";
  const preloved = condition === "preloved";
  if (input.compareAtPesewas !== undefined && (!Number.isSafeInteger(input.compareAtPesewas) || input.compareAtPesewas <= input.pricePesewas)) {
    errors.compareAtPesewas = "The “worth” price must be higher than the selling price, or left empty.";
  }
  const bundleItems = isBundle ? normalizeBundleItems(input.bundleItems, errors) : undefined;
  if (preloved && !(PRELOVED_GRADES as readonly string[]).includes(input.conditionGrade ?? "")) errors.conditionGrade = "Choose how good the preloved copy is.";
  const conditionNote = preloved ? input.conditionNote?.trim() || undefined : undefined;
  if (conditionNote && conditionNote.length > 160) errors.conditionNote = "Keep the condition note under 160 characters.";
  return {
    value: { ...input, sku, isbn, edition: input.edition?.trim() || undefined, condition, conditionGrade: preloved ? input.conditionGrade : undefined, conditionNote, bundleItems },
    errors,
  };
}

function throwIfErrors(errors: Record<string, string>) {
  if (Object.keys(errors).length) throw new AdminError("invalid", "Please fix the highlighted fields.", errors);
}

/** Why a book cannot be published yet. Empty array means ready. */
export function publishBlockers(book: Book, variants: BookVariant[]): string[] {
  const blockers: string[] = [];
  if (!book.cover) blockers.push("Upload a cover image.");
  else if (!book.cover.alt.trim()) blockers.push("Add alt text to the cover image.");
  if (book.description.trim().length < 20) blockers.push("Write a description (at least 20 characters).");
  const sellable = variants.filter((variant) => variant.active && variant.pricePesewas > 0 && variant.weightGrams > 0 && (variant.format !== "Bundle" || (variant.bundleItems?.length ?? 0) > 0));
  if (sellable.some((variant) => variant.format !== "Bundle") && !book.categoryIds.length) blockers.push("Choose at least one book type for Brand New or Preloved stock.");
  if (!sellable.length) blockers.push("Add at least one active variant with a price and shipping weight.");
  return blockers;
}

/* ---------------------------------------------------------------- Books */

async function assertSlugFree(tx: AdminTransaction, slug: string, exceptBookId?: string) {
  const existing = await tx.query("books", { where: [["slug", "==", slug]], limit: 2 });
  if (existing.some((book) => book.id !== exceptBookId)) throw new AdminError("conflict", "Another book already uses this URL slug.", { slug: "Already in use" });
}

async function readSelectedCategories(tx: AdminTransaction, categoryIds: string[]): Promise<Category[]> {
  const categories = await Promise.all(categoryIds.map((id) => tx.get("categories", id)));
  if (categories.some((category) => !category)) {
    throw new AdminError("invalid", "One or more selected categories no longer exist. Choose categories again.", { categoryIds: "Remove missing categories" });
  }
  return categories as Category[];
}

async function assertPublicPlacement(tx: AdminTransaction, book: Book, variants: BookVariant[], selectedCategories?: Category[]) {
  const categories = selectedCategories ?? await readSelectedCategories(tx, book.categoryIds);
  const active = variants.filter((variant) => variant.active);
  if (active.some((variant) => variant.format !== "Bundle") && !categories.some((category) => category.published && category.slug !== "bundles")) {
    throw new AdminError("precondition", "Choose at least one visible book type for Brand New or Preloved stock.");
  }
  if (active.some((variant) => variant.format === "Bundle")) {
    const bundleShelves = await tx.query("categories", { where: [["slug", "==", "bundles"]] });
    if (!bundleShelves.some((category) => category.published)) {
      throw new AdminError("precondition", "Make Bundle Deals visible in Categories before publishing a bundle.");
    }
  }
}

export async function createBook(store: AdminDataStore, ctx: StaffContext, input: BookInput, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  const { value, errors } = validateBookInput(input);
  throwIfErrors(errors);
  return runIdempotent(store, ctx, "catalogue.createBook", idempotencyKey, async (tx) => {
    await assertSlugFree(tx, value.slug!);
    await readSelectedCategories(tx, value.categoryIds);
    const at = nowIso();
    const book: Book = stripUndefined({
      id: newId("book"),
      slug: value.slug!,
      title: value.title,
      subtitle: value.subtitle,
      authors: value.authors,
      publisher: value.publisher,
      description: value.description,
      language: value.language,
      ageBand: value.ageBand,
      categoryIds: value.categoryIds,
      tags: value.tags,
      gallery: [],
      seoTitle: value.seoTitle,
      seoDescription: value.seoDescription,
      relatedBookIds: value.relatedBookIds,
      status: "draft",
      createdAt: at,
      updatedAt: at,
      updatedBy: ctx.uid,
      schemaVersion: SCHEMA_VERSION,
    } satisfies Book);
    tx.create("books", book.id, book);
    recordAudit(tx, ctx, { action: "catalogue.book.create", entityType: "book", entityId: book.id, summary: `Created draft “${book.title}”` });
    return { bookId: book.id };
  });
}

export async function updateBook(store: AdminDataStore, ctx: StaffContext, bookId: string, input: BookInput, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  const { value, errors } = validateBookInput(input);
  throwIfErrors(errors);
  return runIdempotent(store, ctx, "catalogue.updateBook", idempotencyKey, async (tx) => {
    const book = await tx.get("books", bookId);
    if (!book) throw new AdminError("not_found", "Book not found.");
    await assertSlugFree(tx, value.slug!, bookId);
    const selectedCategories = await readSelectedCategories(tx, value.categoryIds);
    if (value.relatedBookIds.includes(bookId)) throw new AdminError("invalid", "A book cannot be related to itself.", { relatedBookIds: "Remove this book" });
    const next: Book = stripUndefined({
      ...book,
      title: value.title,
      subtitle: value.subtitle,
      slug: value.slug!,
      authors: value.authors,
      publisher: value.publisher,
      description: value.description,
      language: value.language,
      ageBand: value.ageBand,
      categoryIds: value.categoryIds,
      tags: value.tags,
      seoTitle: value.seoTitle,
      seoDescription: value.seoDescription,
      relatedBookIds: value.relatedBookIds,
      updatedAt: nowIso(),
      updatedBy: ctx.uid,
    });
    if (book.status === "published") {
      const variants = await tx.query("bookVariants", { where: [["bookId", "==", bookId]] });
      await assertPublicPlacement(tx, next, variants, selectedCategories);
      const blockers = publishBlockers(next, variants);
      if (blockers.length) throw new AdminError("precondition", `This book is live; the edit would make it unpublishable: ${blockers.join(" ")}`);
    }
    tx.set("books", bookId, next);
    recordAudit(tx, ctx, {
      action: "catalogue.book.update",
      entityType: "book",
      entityId: bookId,
      summary: `Edited “${next.title}”`,
      before: pick(book, ["title", "slug", "authors", "categoryIds", "ageBand"]),
      after: pick(next, ["title", "slug", "authors", "categoryIds", "ageBand"]),
    });
    return { bookId };
  });
}

export async function setBookStatus(store: AdminDataStore, ctx: StaffContext, bookId: string, status: PublishStatus, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.publish");
  return runIdempotent(store, ctx, `catalogue.status.${status}`, idempotencyKey, async (tx) => {
    const book = await tx.get("books", bookId);
    if (!book) throw new AdminError("not_found", "Book not found.");
    const variants = await tx.query("bookVariants", { where: [["bookId", "==", bookId]] });
    if (status === "published") {
      await assertPublicPlacement(tx, book, variants);
      const blockers = publishBlockers(book, variants);
      if (blockers.length) throw new AdminError("precondition", `Not ready to publish: ${blockers.join(" ")}`);
    }
    if (book.status === status) return { bookId, status };
    const at = nowIso();
    tx.update("books", bookId, { status, updatedAt: at, updatedBy: ctx.uid, ...(status === "published" ? { publishedAt: book.publishedAt ?? at } : {}) });
    recordAudit(tx, ctx, { action: `catalogue.book.${status}`, entityType: "book", entityId: bookId, summary: `“${book.title}”: ${book.status} → ${status}` });
    return { bookId, status };
  });
}

/** Attach a processed, already-uploaded cover. Returns the previous path for orphan cleanup. */
export async function setBookCover(store: AdminDataStore, ctx: StaffContext, bookId: string, image: ImageRef, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  if (!image.alt.trim() || image.alt.length > 250) throw new AdminError("invalid", "Describe the cover in alt text (max 250 characters).", { alt: "Required" });
  return runIdempotent(store, ctx, "catalogue.cover", idempotencyKey, async (tx) => {
    const book = await tx.get("books", bookId);
    if (!book) throw new AdminError("not_found", "Book not found.");
    tx.update("books", bookId, { cover: image, updatedAt: nowIso(), updatedBy: ctx.uid });
    recordAudit(tx, ctx, { action: "catalogue.book.cover", entityType: "book", entityId: bookId, summary: `${book.cover ? "Replaced" : "Added"} cover for “${book.title}”`, after: { path: image.path, bytes: image.bytes } });
    return { bookId, previousPath: book.cover?.path ?? null };
  });
}

export async function updateCoverAlt(store: AdminDataStore, ctx: StaffContext, bookId: string, alt: string, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  const trimmed = alt.trim();
  if (!trimmed || trimmed.length > 250) throw new AdminError("invalid", "Alt text is required (max 250 characters).", { alt: "Required" });
  return runIdempotent(store, ctx, "catalogue.coverAlt", idempotencyKey, async (tx) => {
    const book = await tx.get("books", bookId);
    if (!book?.cover) throw new AdminError("not_found", "This book has no cover yet.");
    tx.update("books", bookId, { cover: { ...book.cover, alt: trimmed }, updatedAt: nowIso(), updatedBy: ctx.uid });
    recordAudit(tx, ctx, { action: "catalogue.book.coverAlt", entityType: "book", entityId: bookId, summary: "Updated cover alt text" });
    return { bookId };
  });
}

export async function addGalleryImage(store: AdminDataStore, ctx: StaffContext, bookId: string, image: ImageRef, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  if (!image.alt.trim()) throw new AdminError("invalid", "Alt text is required.", { alt: "Required" });
  return runIdempotent(store, ctx, "catalogue.gallery.add", idempotencyKey, async (tx) => {
    const book = await tx.get("books", bookId);
    if (!book) throw new AdminError("not_found", "Book not found.");
    if (book.gallery.length >= 8) throw new AdminError("precondition", "A book can have up to 8 gallery images.");
    tx.update("books", bookId, { gallery: [...book.gallery, image], updatedAt: nowIso(), updatedBy: ctx.uid });
    recordAudit(tx, ctx, { action: "catalogue.book.gallery.add", entityType: "book", entityId: bookId, summary: "Added gallery image", after: { path: image.path } });
    return { bookId };
  });
}

export async function removeGalleryImage(store: AdminDataStore, ctx: StaffContext, bookId: string, path: string, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  return runIdempotent(store, ctx, "catalogue.gallery.remove", idempotencyKey, async (tx) => {
    const book = await tx.get("books", bookId);
    if (!book) throw new AdminError("not_found", "Book not found.");
    tx.update("books", bookId, { gallery: book.gallery.filter((image) => image.path !== path), updatedAt: nowIso(), updatedBy: ctx.uid });
    recordAudit(tx, ctx, { action: "catalogue.book.gallery.remove", entityType: "book", entityId: bookId, summary: "Removed gallery image", before: { path } });
    return { bookId, removedPath: path };
  });
}

/* ------------------------------------------------------------- Variants */

async function assertIsbnFormatFree(tx: AdminTransaction, value: VariantInput, exceptSku?: string) {
  if (!value.isbn) return;
  // The same ISBN may be sold brand new and preloved (and preloved in different grades):
  // those are separate options with their own price and stock, not duplicates.
  const sameOption = (variant: BookVariant) =>
    variant.format === value.format && (variant.condition ?? "new") === value.condition && (variant.conditionGrade ?? "") === (value.conditionGrade ?? "");
  const sameIsbn = (await tx.query("bookVariants", { where: [["isbn", "==", value.isbn]] })).filter((variant) => variant.sku !== exceptSku && sameOption(variant));
  const clash = sameIsbn.find((variant) => (variant.edition ?? "") === (value.edition ?? ""));
  if (clash) throw new AdminError("conflict", `ISBN ${value.isbn} is already listed as ${optionLabel(clash.format, clash.condition, clash.conditionGrade)} under SKU ${clash.sku}. Receive more stock on that SKU instead.`, { isbn: `Used by ${clash.sku}` });
  const sameFormat = sameIsbn[0];
  if (sameFormat && !value.confirmDuplicateIsbn) {
    throw new AdminError("conflict", `ISBN ${value.isbn} already exists as ${sameFormat.format} (${sameFormat.sku}). Tick “separate listing” if this is deliberate.`, { isbn: `Also on ${sameFormat.sku}` });
  }
}

/**
 * Check linked bundle SKUs inside the transaction and fill missing titles
 * from their books. A bundle cannot contain itself or another bundle.
 */
async function resolveBundleItems(tx: AdminTransaction, bundleSku: string, items: BundleItem[] | undefined): Promise<BundleItem[] | undefined> {
  if (!items) return undefined;
  const resolved: BundleItem[] = [];
  for (const item of items) {
    if (!item.sku) {
      resolved.push(item);
      continue;
    }
    if (item.sku === bundleSku) throw new AdminError("invalid", "A bundle cannot contain itself.", { bundleItems: "Remove this bundle’s own SKU" });
    const component = await tx.get("bookVariants", item.sku);
    if (!component) throw new AdminError("invalid", `SKU ${item.sku} does not exist.`, { bundleItems: `Unknown SKU ${item.sku}` });
    if (component.format === "Bundle") throw new AdminError("invalid", `${item.sku} is itself a bundle. Bundles cannot contain bundles.`, { bundleItems: "No bundles inside bundles" });
    const title = item.title || (await tx.get("books", component.bookId))?.title || item.sku;
    resolved.push({ sku: item.sku, title, quantity: item.quantity });
  }
  return resolved;
}

const linkedKey = (items: BundleItem[] | undefined) =>
  JSON.stringify((items ?? []).filter((item) => item.sku).map((item) => [item.sku, item.quantity]).sort());

export async function createVariant(store: AdminDataStore, ctx: StaffContext, bookId: string, input: VariantInput, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  const { value, errors } = validateVariantInput(input);
  if (value.costPesewas !== undefined && !can(ctx, "finance.view")) delete value.costPesewas;
  throwIfErrors(errors);
  return runIdempotent(store, ctx, "catalogue.createVariant", idempotencyKey, async (tx) => {
    const book = await tx.get("books", bookId);
    if (!book) throw new AdminError("not_found", "Book not found.");
    const existing = await tx.get("bookVariants", value.sku);
    if (existing) throw new AdminError("conflict", `SKU ${value.sku} is already used.`, { sku: "Already in use" });
    await assertIsbnFormatFree(tx, value);
    const bundleItems = await resolveBundleItems(tx, value.sku, value.bundleItems);
    const settings = await tx.get("siteSettings", "site");
    const at = nowIso();
    const variant: BookVariant = stripUndefined({
      sku: value.sku,
      bookId,
      format: value.format,
      condition: value.condition,
      conditionGrade: value.conditionGrade,
      conditionNote: value.conditionNote,
      edition: value.edition,
      isbn: value.isbn,
      pricePesewas: value.pricePesewas,
      compareAtPesewas: value.compareAtPesewas,
      bundleItems,
      costPesewas: value.costPesewas,
      weightGrams: value.weightGrams,
      active: value.active,
      createdAt: at,
      updatedAt: at,
      updatedBy: ctx.uid,
      schemaVersion: SCHEMA_VERSION,
    } satisfies BookVariant);
    if (book.status === "published") {
      const siblings = await tx.query("bookVariants", { where: [["bookId", "==", bookId]] });
      await assertPublicPlacement(tx, book, [...siblings, variant]);
    }
    // A new SKU starts at zero; opening stock must arrive as a STOCK_RECEIVED movement.
    const inventory: InventoryRecord = { sku: value.sku, onHand: 0, reserved: 0, lowStockThreshold: settings?.defaultLowStockThreshold ?? 3, version: 1, updatedAt: at };
    tx.create("bookVariants", variant.sku, variant);
    tx.create("inventory", variant.sku, inventory);
    tx.update("books", bookId, { updatedAt: at, updatedBy: ctx.uid });
    recordAudit(tx, ctx, { action: "catalogue.variant.create", entityType: "bookVariant", entityId: variant.sku, summary: `Added ${optionLabel(variant.format, variant.condition, variant.conditionGrade)} ${variant.sku} to “${book.title}” at ${variant.pricePesewas} pesewas` });
    return { sku: variant.sku };
  });
}

export async function updateVariant(store: AdminDataStore, ctx: StaffContext, sku: string, input: Omit<VariantInput, "sku">, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.edit");
  const { value, errors } = validateVariantInput({ ...input, sku });
  throwIfErrors(errors);
  return runIdempotent(store, ctx, "catalogue.updateVariant", idempotencyKey, async (tx) => {
    const variant = await tx.get("bookVariants", sku);
    if (!variant) throw new AdminError("not_found", "Variant not found.");
    await assertIsbnFormatFree(tx, value, sku);
    const bundleItems = await resolveBundleItems(tx, sku, value.bundleItems);
    const inventory = await tx.get("inventory", sku);
    if (inventory && inventory.onHand > 0 && linkedKey(variant.bundleItems) !== linkedKey(bundleItems)) {
      throw new AdminError("precondition", `${inventory.onHand} of these bundles are already made up from stock. Unpack them in Inventory before changing the stocked items inside.`, { bundleItems: "Unpack made-up bundles first" });
    }
    const book = await tx.get("books", variant.bookId);
    const siblings = book?.status === "published" ? await tx.query("bookVariants", { where: [["bookId", "==", variant.bookId]] }) : [];
    const next: BookVariant = stripUndefined({
      ...variant,
      format: value.format,
      condition: value.condition,
      conditionGrade: value.conditionGrade,
      conditionNote: value.conditionNote,
      edition: value.edition,
      isbn: value.isbn,
      pricePesewas: value.pricePesewas,
      compareAtPesewas: value.compareAtPesewas,
      bundleItems,
      costPesewas: can(ctx, "finance.view") ? value.costPesewas : variant.costPesewas,
      weightGrams: value.weightGrams,
      active: value.active,
      updatedAt: nowIso(),
      updatedBy: ctx.uid,
    });
    if (book?.status === "published") {
      const nextVariants = siblings.map((sibling) => (sibling.sku === sku ? next : sibling));
      await assertPublicPlacement(tx, book, nextVariants);
      const blockers = publishBlockers(book, nextVariants);
      if (blockers.length) throw new AdminError("precondition", `“${book.title}” is live; unpublish it first or keep one sellable variant. ${blockers.join(" ")}`);
    }
    tx.set("bookVariants", sku, next);
    recordAudit(tx, ctx, {
      action: "catalogue.variant.update",
      entityType: "bookVariant",
      entityId: sku,
      summary: `Edited ${sku}`,
      before: pick(variant, ["pricePesewas", "weightGrams", "active", "format", "condition", "conditionGrade", "isbn"]),
      after: pick(next, ["pricePesewas", "weightGrams", "active", "format", "condition", "conditionGrade", "isbn"]),
    });
    return { sku };
  });
}

/* ----------------------------------------------------------- Categories */

export interface CategoryInput {
  id?: string;
  name: string;
  slug?: string;
  caption?: string;
  order: number;
  published: boolean;
}

export async function saveCategory(store: AdminDataStore, ctx: StaffContext, input: CategoryInput, idempotencyKey: string) {
  assertPermission(ctx, "content.edit");
  const name = input.name.trim();
  const slug = (input.slug?.trim() || slugify(name)).toLowerCase();
  if (!name || name.length > 60) throw new AdminError("invalid", "Category name is required.", { name: "Required" });
  if (!isValidSlug(slug)) throw new AdminError("invalid", "Invalid slug.", { slug: "Lowercase letters, numbers, hyphens" });
  return runIdempotent(store, ctx, "catalogue.category", idempotencyKey, async (tx) => {
    const clash = await tx.query("categories", { where: [["slug", "==", slug]] });
    if (clash.some((category) => category.id !== input.id)) throw new AdminError("conflict", "Another category uses this slug.", { slug: "Already in use" });
    const existing = input.id ? await tx.get("categories", input.id) : null;
    if (input.id && !existing) throw new AdminError("not_found", "Category not found.");
    const category: Category = stripUndefined({
      ...(existing ?? {}),
      id: existing?.id ?? slug,
      name,
      slug,
      caption: input.caption?.trim() || undefined,
      order: Number.isInteger(input.order) ? input.order : 0,
      published: input.published,
      updatedAt: nowIso(),
    });
    if (existing) tx.set("categories", category.id, category);
    else tx.create("categories", category.id, category);
    recordAudit(tx, ctx, { action: existing ? "catalogue.category.update" : "catalogue.category.create", entityType: "category", entityId: category.id, summary: `${existing ? "Updated" : "Created"} category ${name}` });
    return { categoryId: category.id };
  });
}

/* ----------------------------------------------------------------- Reads */

export interface CatalogueRow {
  book: Book;
  variants: (BookVariant & { available: number; onHand: number })[];
  totalAvailable: number;
  minPricePesewas: number | null;
  blockers: string[];
}

export interface CatalogueFilter {
  q?: string;
  status?: PublishStatus | "all";
  categoryId?: string;
  stock?: "all" | "in" | "low" | "out";
  sort?: "updated" | "title" | "stock" | "price";
}

export async function listCatalogue(store: AdminDataStore, ctx: StaffContext, filter: CatalogueFilter = {}): Promise<CatalogueRow[]> {
  assertPermission(ctx, "catalogue.view");
  const [books, variants, inventory, categories] = await Promise.all([store.query("books"), store.query("bookVariants"), store.query("inventory"), store.query("categories")]);
  const bundleCategoryIds = new Set(categories.filter((category) => category.slug === "bundles").map((category) => category.id));
  const inventoryBySku = new Map(inventory.map((record) => [record.sku, record]));
  const showCost = can(ctx, "finance.view");
  const rows: CatalogueRow[] = books.map((book) => {
    const own = variants
      .filter((variant) => variant.bookId === book.id)
      .map((variant) => {
        const record = inventoryBySku.get(variant.sku);
        return { ...variant, costPesewas: showCost ? variant.costPesewas : undefined, onHand: record?.onHand ?? 0, available: record ? availableOf(record) : 0 };
      });
    const sellable = own.filter((variant) => variant.active);
    return {
      book,
      variants: own,
      totalAvailable: sellable.reduce((sum, variant) => sum + Math.max(0, variant.available), 0),
      minPricePesewas: sellable.length ? Math.min(...sellable.map((variant) => variant.pricePesewas)) : null,
      blockers: publishBlockers(book, own),
    };
  });
  const q = filter.q?.trim().toLowerCase();
  const lowThreshold = (row: CatalogueRow) =>
    row.variants.some((variant) => {
      const record = inventoryBySku.get(variant.sku);
      return variant.active && record && availableOf(record) > 0 && availableOf(record) <= record.lowStockThreshold;
    });
  const filtered = rows.filter((row) => {
    if (filter.status && filter.status !== "all" && row.book.status !== filter.status) return false;
    if (filter.categoryId && !(bundleCategoryIds.has(filter.categoryId) ? row.variants.some((variant) => variant.format === "Bundle") : row.book.categoryIds.includes(filter.categoryId))) return false;
    if (filter.stock === "out" && row.totalAvailable > 0) return false;
    if (filter.stock === "in" && row.totalAvailable <= 0) return false;
    if (filter.stock === "low" && !lowThreshold(row)) return false;
    if (q) {
      const haystack = [row.book.title, row.book.subtitle ?? "", row.book.slug, ...row.book.authors, ...row.book.tags, ...row.variants.flatMap((variant) => [variant.sku, variant.isbn ?? ""])].join(" ").toLowerCase();
      const qIsbn = q.replace(/[\s-]/g, "");
      if (!haystack.includes(q) && !haystack.includes(qIsbn)) return false;
    }
    return true;
  });
  const sort = filter.sort ?? "updated";
  return filtered.sort((left, right) => {
    if (sort === "title") return left.book.title.localeCompare(right.book.title);
    if (sort === "stock") return left.totalAvailable - right.totalAvailable;
    if (sort === "price") return (left.minPricePesewas ?? Infinity) - (right.minPricePesewas ?? Infinity);
    return right.book.updatedAt.localeCompare(left.book.updatedAt);
  });
}

export async function getBookForEdit(store: AdminDataStore, ctx: StaffContext, bookId: string) {
  assertPermission(ctx, "catalogue.view");
  const rows = await listCatalogue(store, ctx, {});
  return rows.find((row) => row.book.id === bookId) ?? null;
}

export async function listCategories(store: AdminDataStore): Promise<Category[]> {
  return store.query("categories", { orderBy: { field: "order", direction: "asc" } });
}

/**
 * The storefront-facing shape of a published book. This is what the shared
 * catalogue reader should return to `src/app/(storefront)` (request R4). Only
 * published books with active variants appear; availability is per SKU.
 */
export interface StorefrontBookContract {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  description: string;
  language: string;
  ageBand: AgeBand;
  categorySlugs: string[];
  tags: string[];
  cover: { url: string; alt: string; width: number; height: number };
  gallery: { url: string; alt: string; width: number; height: number }[];
  seo: { title: string; description: string };
  relatedSlugs: string[];
  variants: { sku: string; format: string; condition: ItemCondition; conditionGrade?: PrelovedGrade; conditionNote?: string; label: string; edition?: string; isbn?: string; pricePesewas: number; weightGrams: number; available: number; inStock: boolean }[];
}

export async function storefrontContractFor(store: AdminDataStore, ctx: StaffContext, bookId: string): Promise<StorefrontBookContract | null> {
  assertPermission(ctx, "catalogue.view");
  const [book, categories, books] = await Promise.all([store.get("books", bookId), store.query("categories"), store.query("books", { where: [["status", "==", "published"]] })]);
  if (!book || !book.cover) return null;
  const variants = await store.query("bookVariants", { where: [["bookId", "==", bookId]] });
  const inventory = await Promise.all(variants.map((variant) => store.get("inventory", variant.sku)));
  const inventoryBySku = new Map(inventory.flatMap((record) => (record ? [[record.sku, record] as const] : [])));
  const slugOf = new Map(categories.map((category) => [category.id, category.slug]));
  const publishedSlug = new Map(books.map((other) => [other.id, other.slug]));
  return stripUndefined({
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors,
    publisher: book.publisher,
    description: book.description,
    language: book.language,
    ageBand: book.ageBand,
    categorySlugs: book.categoryIds.map((id) => slugOf.get(id) ?? id),
    tags: book.tags,
    cover: { url: book.cover.url, alt: book.cover.alt, width: book.cover.width, height: book.cover.height },
    gallery: book.gallery.map((image) => ({ url: image.url, alt: image.alt, width: image.width, height: image.height })),
    seo: { title: book.seoTitle ?? `${book.title} | Bookish Delight`, description: book.seoDescription ?? book.description.slice(0, 160) },
    relatedSlugs: book.relatedBookIds.flatMap((id) => (publishedSlug.has(id) ? [publishedSlug.get(id)!] : [])),
    variants: variants
      .filter((variant) => variant.active)
      .map((variant) => {
        const record = inventoryBySku.get(variant.sku);
        const available = record ? Math.max(0, availableOf(record)) : 0;
        return { sku: variant.sku, format: variant.format, condition: variant.condition ?? "new", conditionGrade: variant.conditionGrade, conditionNote: variant.conditionNote, label: optionLabel(variant.format, variant.condition, variant.conditionGrade), edition: variant.edition, isbn: variant.isbn, pricePesewas: variant.pricePesewas, weightGrams: variant.weightGrams, available, inStock: available > 0 };
      }),
  });
}
