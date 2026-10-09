import { recordAudit, stripUndefined } from "@/lib/admin/audit";
import { assertPermission, can, type StaffContext } from "@/lib/admin/context";
import { parseCsv, rowsToObjects, toCsv } from "@/lib/admin/csv";
import { AdminError } from "@/lib/admin/errors";
import { parseGhsToPesewas, pesewasToDecimal } from "@/lib/admin/format";
import { derivedId, newId, nowIso, sha256Hex } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import { validateBookInput, validateVariantInput } from "@/lib/admin/ops/catalogue";
import type { AdminDataStore } from "@/lib/admin/store/types";
import { SCHEMA_VERSION, type AdminBookFormat, type AgeBand, type Book, type BookVariant, type InventoryRecord, type StockMovement } from "@/lib/admin/types";
import { splitList } from "@/lib/admin/validation";

/**
 * Bulk catalogue import: dry-run first, then an explicit confirmed commit of
 * the exact same file (matched by content hash). Rows only ever create new
 * draft books/variants; existing SKUs are rejected, never overwritten. The
 * whole file commits in one transaction or not at all.
 */

export const IMPORT_COLUMNS = [
  "book_slug",
  "title",
  "authors",
  "publisher",
  "description",
  "language",
  "age_band",
  "categories",
  "tags",
  "sku",
  "format",
  "edition",
  "isbn",
  "price_ghs",
  "weight_grams",
  "active",
  "opening_quantity",
  "opening_reference",
] as const;

export const MAX_IMPORT_ROWS = 80;
const REQUIRED = ["title", "authors", "sku", "format", "price_ghs", "weight_grams"] as const;

export interface ImportRowResult {
  line: number;
  sku: string;
  bookSlug: string;
  action: "create_book_and_variant" | "add_variant_to_new_book" | "add_variant_to_existing_book" | "error";
  openingQuantity: number;
  errors: string[];
}

export interface ImportPlan {
  fileHash: string;
  rows: ImportRowResult[];
  newBooks: number;
  newVariants: number;
  openingUnits: number;
  errorCount: number;
  headerProblems: string[];
}

interface PreparedRow {
  line: number;
  book: Omit<Book, "id" | "createdAt" | "updatedAt" | "updatedBy" | "schemaVersion" | "status" | "gallery">;
  variant: Omit<BookVariant, "bookId" | "createdAt" | "updatedAt" | "updatedBy" | "schemaVersion">;
  openingQuantity: number;
  openingReference: string;
}

async function prepare(store: AdminDataStore, ctx: StaffContext, csvText: string): Promise<{ plan: ImportPlan; prepared: PreparedRow[]; existingBookBySlug: Map<string, Book> }> {
  const fileHash = sha256Hex(csvText);
  const { header, records } = rowsToObjects(parseCsv(csvText));
  const headerProblems: string[] = [];
  for (const column of REQUIRED) if (!header.includes(column)) headerProblems.push(`Missing required column “${column}”.`);
  const unknown = header.filter((column) => !(IMPORT_COLUMNS as readonly string[]).includes(column));
  if (unknown.length) headerProblems.push(`Unknown columns: ${unknown.join(", ")}.`);
  if (records.length > MAX_IMPORT_ROWS) headerProblems.push(`Up to ${MAX_IMPORT_ROWS} rows per file (this file has ${records.length}). Split it into smaller files.`);
  if (!records.length) headerProblems.push("The file has no data rows.");

  const [books, variants, categories] = await Promise.all([store.query("books"), store.query("bookVariants"), store.query("categories")]);
  const existingBookBySlug = new Map(books.map((book) => [book.slug, book]));
  const existingSkus = new Set(variants.map((variant) => variant.sku));
  const isbnFormats = new Set(variants.filter((variant) => variant.isbn).map((variant) => `${variant.isbn}|${variant.format}|${variant.edition ?? ""}`));
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const canReceive = can(ctx, "inventory.receive");

  const seenSkus = new Set<string>();
  const seenIsbnFormats = new Set<string>();
  const firstRowForSlug = new Map<string, PreparedRow>();
  const rows: ImportRowResult[] = [];
  const prepared: PreparedRow[] = [];

  records.forEach((record, index) => {
    const line = index + 2;
    const errors: string[] = [];
    for (const column of REQUIRED) if (!record[column]) errors.push(`${column} is required.`);
    const categorySlugs = splitList(record.categories ?? "");
    const unknownCategories = categorySlugs.filter((slug) => !categoryBySlug.has(slug));
    if (unknownCategories.length) errors.push(`Unknown categories: ${unknownCategories.join(", ")}.`);
    const { value: book, errors: bookErrors } = validateBookInput({
      title: record.title ?? "",
      slug: record.book_slug || undefined,
      authors: splitList(record.authors ?? ""),
      publisher: record.publisher,
      description: record.description ?? "",
      language: record.language || "English",
      ageBand: (record.age_band || "all-ages") as AgeBand,
      categoryIds: categorySlugs.flatMap((slug) => (categoryBySlug.has(slug) ? [categoryBySlug.get(slug)!] : [])),
      tags: splitList(record.tags ?? ""),
      relatedBookIds: [],
    });
    errors.push(...Object.entries(bookErrors).map(([field, message]) => `${field}: ${message}`));
    const pricePesewas = parseGhsToPesewas(record.price_ghs ?? "");
    if (pricePesewas === null) errors.push("price_ghs must be a GHS amount like 95 or 95.50.");
    const weightGrams = Number(record.weight_grams);
    const { value: variant, errors: variantErrors } = validateVariantInput({
      sku: record.sku ?? "",
      format: record.format as AdminBookFormat,
      edition: record.edition,
      isbn: record.isbn || undefined,
      pricePesewas: pricePesewas ?? 0,
      weightGrams: Number.isFinite(weightGrams) ? Math.round(weightGrams) : -1,
      active: !/^(no|false|0)$/i.test(record.active ?? ""),
    });
    errors.push(...Object.entries(variantErrors).map(([field, message]) => `${field}: ${message}`));
    if (existingSkus.has(variant.sku)) errors.push(`SKU ${variant.sku} already exists; imports never overwrite.`);
    if (seenSkus.has(variant.sku)) errors.push(`SKU ${variant.sku} appears more than once in this file.`);
    seenSkus.add(variant.sku);
    if (variant.isbn) {
      const key = `${variant.isbn}|${variant.format}|${variant.edition ?? ""}`;
      if (isbnFormats.has(key) || seenIsbnFormats.has(key)) errors.push(`ISBN ${variant.isbn} is already listed as ${variant.format}${variant.edition ? ` (${variant.edition})` : ""}.`);
      seenIsbnFormats.add(key);
    }
    const openingQuantity = record.opening_quantity ? Number(record.opening_quantity) : 0;
    if (!Number.isInteger(openingQuantity) || openingQuantity < 0 || openingQuantity > 10_000) errors.push("opening_quantity must be a whole number 0–10,000.");
    if (openingQuantity > 0 && !canReceive) errors.push("Your role cannot receive opening stock; leave opening_quantity blank.");
    if (openingQuantity > 0 && !(record.opening_reference ?? "").trim()) errors.push("opening_reference is required when opening_quantity is set.");

    const slug = book.slug!;
    const existingBook = existingBookBySlug.get(slug);
    const firstForSlug = firstRowForSlug.get(slug);
    if (firstForSlug && firstForSlug.book.title !== book.title) errors.push(`Rows for slug “${slug}” must share the same title (line ${firstForSlug.line} says “${firstForSlug.book.title}”).`);
    if (existingBook && existingBook.status === "archived") errors.push(`Book “${slug}” is archived; restore it before adding variants.`);

    const action: ImportRowResult["action"] = errors.length ? "error" : existingBook ? "add_variant_to_existing_book" : firstForSlug ? "add_variant_to_new_book" : "create_book_and_variant";
    rows.push({ line, sku: variant.sku, bookSlug: slug, action, openingQuantity: errors.length ? 0 : openingQuantity, errors });
    if (!errors.length) {
      const preparedRow: PreparedRow = {
        line,
        book: stripUndefined({
          slug,
          title: book.title,
          authors: book.authors,
          publisher: book.publisher,
          description: book.description,
          language: book.language,
          ageBand: book.ageBand,
          categoryIds: book.categoryIds,
          tags: book.tags,
          relatedBookIds: [],
        }),
        variant: stripUndefined({ sku: variant.sku, format: variant.format, edition: variant.edition, isbn: variant.isbn, pricePesewas: variant.pricePesewas, weightGrams: variant.weightGrams, active: variant.active }),
        openingQuantity,
        openingReference: (record.opening_reference ?? "").trim(),
      };
      if (!firstForSlug) firstRowForSlug.set(slug, preparedRow);
      prepared.push(preparedRow);
    }
  });

  const errorCount = rows.filter((row) => row.action === "error").length + headerProblems.length;
  return {
    plan: {
      fileHash,
      rows,
      newBooks: rows.filter((row) => row.action === "create_book_and_variant").length,
      newVariants: rows.filter((row) => row.action !== "error").length,
      openingUnits: rows.reduce((sum, row) => sum + row.openingQuantity, 0),
      errorCount,
      headerProblems,
    },
    prepared,
    existingBookBySlug,
  };
}

export async function dryRunImport(store: AdminDataStore, ctx: StaffContext, csvText: string): Promise<ImportPlan> {
  assertPermission(ctx, "catalogue.import");
  if (csvText.length > 512_000) throw new AdminError("invalid", "CSV files must be under 500 KB.");
  return (await prepare(store, ctx, csvText)).plan;
}

export async function commitImport(store: AdminDataStore, ctx: StaffContext, csvText: string, confirmedHash: string, idempotencyKey: string) {
  assertPermission(ctx, "catalogue.import");
  const { plan, prepared } = await prepare(store, ctx, csvText);
  if (plan.fileHash !== confirmedHash) throw new AdminError("conflict", "The file changed after the dry run. Run the dry run again.");
  if (plan.errorCount > 0) throw new AdminError("precondition", `Fix the ${plan.errorCount} problem(s) found in the dry run before importing.`);
  return runIdempotent(store, ctx, "catalogue.import", idempotencyKey, async (tx) => {
    // Re-check inside the transaction: nothing may have been created since the dry run.
    const bookIdBySlug = new Map<string, string>();
    for (const row of prepared) {
      if (await tx.get("bookVariants", row.variant.sku)) throw new AdminError("conflict", `SKU ${row.variant.sku} was created by someone else since the dry run.`);
      if (!bookIdBySlug.has(row.book.slug)) {
        const existing = await tx.query("books", { where: [["slug", "==", row.book.slug]], limit: 1 });
        if (existing[0]) bookIdBySlug.set(row.book.slug, existing[0].id);
      }
    }
    const settings = await tx.get("siteSettings", "site");
    const at = nowIso();
    const created = new Set<string>();
    for (const row of prepared) {
      let bookId = bookIdBySlug.get(row.book.slug);
      if (!bookId) {
        bookId = newId("book");
        bookIdBySlug.set(row.book.slug, bookId);
        const book: Book = { ...row.book, id: bookId, gallery: [], status: "draft", createdAt: at, updatedAt: at, updatedBy: ctx.uid, schemaVersion: SCHEMA_VERSION };
        tx.create("books", bookId, book);
        created.add(bookId);
      }
      tx.create("bookVariants", row.variant.sku, { ...row.variant, bookId, createdAt: at, updatedAt: at, updatedBy: ctx.uid, schemaVersion: SCHEMA_VERSION });
      const inventory: InventoryRecord = { sku: row.variant.sku, onHand: row.openingQuantity, reserved: 0, lowStockThreshold: settings?.defaultLowStockThreshold ?? 3, version: 1, updatedAt: at };
      tx.create("inventory", row.variant.sku, inventory);
      if (row.openingQuantity > 0) {
        // The variant is created at zero and the opening quantity arrives as a ledger entry.
        const movementId = derivedId("mov", "import", plan.fileHash, row.variant.sku);
        const movement: StockMovement = {
          id: movementId,
          sku: row.variant.sku,
          type: "STOCK_RECEIVED",
          onHandDelta: row.openingQuantity,
          reservedDelta: 0,
          onHandAfter: row.openingQuantity,
          reservedAfter: 0,
          reason: "Opening stock (CSV import)",
          reference: row.openingReference,
          actorUid: ctx.uid,
          actorName: ctx.name,
          createdAt: at,
        };
        tx.create("stockMovements", movementId, movement);
      }
    }
    recordAudit(tx, ctx, {
      action: "catalogue.import",
      entityType: "catalogue",
      entityId: plan.fileHash.slice(0, 16),
      summary: `Imported ${plan.newVariants} variant(s), ${created.size} new draft book(s), ${plan.openingUnits} opening unit(s)`,
      after: { skus: prepared.map((row) => row.variant.sku) },
    });
    return { books: created.size, variants: prepared.length, openingUnits: plan.openingUnits };
  });
}

export async function exportCatalogueCsv(store: AdminDataStore, ctx: StaffContext): Promise<string> {
  assertPermission(ctx, "catalogue.view");
  const [books, variants, inventory, categories] = await Promise.all([store.query("books"), store.query("bookVariants"), store.query("inventory"), store.query("categories")]);
  const bookById = new Map(books.map((book) => [book.id, book]));
  const inventoryBySku = new Map(inventory.map((record) => [record.sku, record]));
  const categorySlug = new Map(categories.map((category) => [category.id, category.slug]));
  const rows = variants
    .map((variant) => ({ variant, book: bookById.get(variant.bookId) }))
    .filter((entry): entry is { variant: BookVariant; book: Book } => Boolean(entry.book))
    .sort((left, right) => left.book.title.localeCompare(right.book.title))
    .map(({ variant, book }) => {
      const record = inventoryBySku.get(variant.sku);
      return [
        book.slug,
        book.title,
        book.authors.join("; "),
        book.publisher ?? "",
        book.description,
        book.language,
        book.ageBand,
        book.categoryIds.map((id) => categorySlug.get(id) ?? id).join("; "),
        book.tags.join("; "),
        variant.sku,
        variant.format,
        variant.edition ?? "",
        variant.isbn ?? "",
        pesewasToDecimal(variant.pricePesewas),
        variant.weightGrams,
        variant.active ? "yes" : "no",
        book.status,
        record?.onHand ?? 0,
        record?.reserved ?? 0,
        record ? record.onHand - record.reserved : 0,
      ];
    });
  return toCsv([...IMPORT_COLUMNS.slice(0, 16), "status", "on_hand", "reserved", "available"], rows);
}

export function importTemplateCsv(): string {
  return toCsv([...IMPORT_COLUMNS], [
    ["", "Example Title (delete this row)", "Ama Example", "Example Press", "A short description.", "English", "8-12", "children", "adventure", "EXAMPLE-PB-01", "Paperback", "", "", "95.00", "320", "yes", "0", ""],
  ]);
}
