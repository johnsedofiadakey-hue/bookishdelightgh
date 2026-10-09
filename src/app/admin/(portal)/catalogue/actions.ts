"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { bool, idempotencyKey, int, list, optionalText, runAction, text } from "@/lib/admin/actions";
import { AdminError } from "@/lib/admin/errors";
import { parseGhsToPesewas } from "@/lib/admin/format";
import { deleteImageQuietly } from "@/lib/admin/media";
import { commitImport, dryRunImport } from "@/lib/admin/ops/catalogue-import";
import { createBook, createVariant, removeGalleryImage, setBookStatus, updateBook, updateCoverAlt, updateVariant, type BookInput } from "@/lib/admin/ops/catalogue";
import type { AdminBookFormat, AgeBand, ItemCondition, PrelovedGrade, PublishStatus } from "@/lib/admin/types";
import { splitList } from "@/lib/admin/validation";

function bookInput(form: FormData): BookInput {
  return {
    title: text(form, "title"),
    subtitle: optionalText(form, "subtitle"),
    slug: optionalText(form, "slug"),
    authors: splitList(text(form, "authors")),
    publisher: optionalText(form, "publisher"),
    description: text(form, "description"),
    language: text(form, "language"),
    ageBand: text(form, "ageBand") as AgeBand,
    categoryIds: list(form, "categoryIds"),
    tags: splitList(text(form, "tags")),
    seoTitle: optionalText(form, "seoTitle"),
    seoDescription: optionalText(form, "seoDescription"),
    relatedBookIds: list(form, "relatedBookIds"),
  };
}

export async function saveBookAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const bookId = optionalText(form, "bookId");
  return runAction("catalogue.edit", async ({ store, ctx }) => {
    if (bookId) {
      await updateBook(store, ctx, bookId, bookInput(form), idempotencyKey(form));
      return { message: "Book details saved." };
    }
    const { result } = await createBook(store, ctx, bookInput(form), idempotencyKey(form));
    return { message: "Draft created. Now choose Brand New, Preloved or Bundle Deals under stock options.", redirectTo: `/admin/catalogue/${result.bookId}` };
  });
}

export async function setBookStatusAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const status = text(form, "status") as PublishStatus;
  return runAction("catalogue.publish", async ({ store, ctx }) => {
    if (!["draft", "published", "archived"].includes(status)) throw new AdminError("invalid", "Unknown status.");
    await setBookStatus(store, ctx, text(form, "bookId"), status, idempotencyKey(form));
    return { message: status === "published" ? "Published — this book is now available to the storefront." : status === "archived" ? "Archived. It is hidden from the storefront and cannot be sold." : "Moved back to draft. It is hidden from the storefront." };
  });
}

function variantFields(form: FormData) {
  const price = parseGhsToPesewas(text(form, "price"));
  const cost = optionalText(form, "cost");
  const costPesewas = cost ? parseGhsToPesewas(cost) : undefined;
  if (price === null) throw new AdminError("invalid", "Enter the selling price in GHS.", { price: "e.g. 95 or 95.50" });
  if (costPesewas === null) throw new AdminError("invalid", "Enter the cost in GHS or leave it blank.", { cost: "e.g. 60.00" });
  const compareAt = optionalText(form, "compareAt");
  const compareAtPesewas = compareAt ? parseGhsToPesewas(compareAt) : undefined;
  if (compareAtPesewas === null) throw new AdminError("invalid", "Enter the “worth” price in GHS or leave it blank.", { compareAtPesewas: "e.g. 250.00" });
  const format = text(form, "format") as AdminBookFormat;
  const skus = form.getAll("bundleSku").map(String);
  const titles = form.getAll("bundleTitle").map(String);
  const quantities = form.getAll("bundleQty").map((value) => Number(value));
  const bundleItems = format === "Bundle" ? titles.map((title, index) => ({ sku: skus[index] || undefined, title, quantity: Number.isFinite(quantities[index]) ? quantities[index] : 0 })) : undefined;
  return {
    format,
    condition: text(form, "condition") as ItemCondition,
    conditionGrade: (optionalText(form, "conditionGrade") as PrelovedGrade | undefined),
    conditionNote: optionalText(form, "conditionNote"),
    edition: optionalText(form, "edition"),
    isbn: optionalText(form, "isbn"),
    pricePesewas: price,
    compareAtPesewas,
    bundleItems,
    costPesewas,
    weightGrams: int(form, "weightGrams"),
    active: bool(form, "active"),
    confirmDuplicateIsbn: bool(form, "confirmDuplicateIsbn"),
  };
}

export async function createVariantAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("catalogue.edit", async ({ store, ctx }) => {
    const { result } = await createVariant(store, ctx, text(form, "bookId"), { sku: text(form, "sku"), ...variantFields(form) }, idempotencyKey(form));
    return { message: `Stock option ${result.sku} created at zero stock. Receive opening stock from Inventory.` };
  });
}

export async function updateVariantAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("catalogue.edit", async ({ store, ctx }) => {
    await updateVariant(store, ctx, text(form, "sku"), variantFields(form), idempotencyKey(form));
    return { message: "Stock option saved." };
  });
}

export async function updateCoverAltAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("catalogue.edit", async ({ store, ctx }) => {
    await updateCoverAlt(store, ctx, text(form, "bookId"), text(form, "alt"), idempotencyKey(form));
    return { message: "Alt text saved." };
  });
}

export async function removeGalleryImageAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("catalogue.edit", async ({ store, ctx }) => {
    const { result, replayed } = await removeGalleryImage(store, ctx, text(form, "bookId"), text(form, "path"), idempotencyKey(form));
    if (!replayed) await deleteImageQuietly(result.removedPath);
    return { message: "Image removed." };
  });
}

async function csvFrom(form: FormData): Promise<string> {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 512_000) throw new AdminError("invalid", "CSV files must be under 500 KB.", { file: "Too large" });
    return file.text();
  }
  const pasted = text(form, "csvText");
  if (!pasted.trim()) throw new AdminError("invalid", "Choose a CSV file.", { file: "Required" });
  return pasted;
}

export async function importDryRunAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("catalogue.import", async ({ store, ctx }) => {
    const csv = await csvFrom(form);
    const plan = await dryRunImport(store, ctx, csv);
    return {
      message: plan.errorCount ? `Dry run found ${plan.errorCount} problem(s). Nothing was written.` : `Dry run passed: ${plan.newVariants} variant(s), ${plan.newBooks} new book(s). Nothing written yet.`,
      data: { plan: JSON.parse(JSON.stringify(plan)), csv },
    };
  });
}

export async function importCommitAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("catalogue.import", async ({ store, ctx }) => {
    if (!bool(form, "confirm")) throw new AdminError("invalid", "Tick the confirmation box to import.", { confirm: "Required" });
    const { result, replayed } = await commitImport(store, ctx, text(form, "csvText"), text(form, "fileHash"), idempotencyKey(form));
    return { message: replayed ? "This import was already applied." : `Imported ${result.variants} variant(s) into ${result.books} new draft book(s) with ${result.openingUnits} opening unit(s).`, redirectTo: "/admin/catalogue?status=draft" };
  });
}
