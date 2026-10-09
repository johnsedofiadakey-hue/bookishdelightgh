import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AdminError } from "@/lib/admin/errors";
import { dryRunImport } from "@/lib/admin/ops/catalogue-import";
import { createBook, createVariant, setBookCover, setBookStatus, updateVariant } from "@/lib/admin/ops/catalogue";
import { receiveStock } from "@/lib/admin/ops/inventory";
import { RECOMMENDED_CATEGORIES } from "@/lib/admin/recommended-categories";
import { MemoryAdminStore } from "@/lib/admin/store/memory";
import { priceCart } from "@/lib/commerce/checkout";
import { conditionLabel, optionLabel } from "@/lib/contracts/catalog";
import { loadPublicCatalog, loadPublicCategories } from "@/lib/storefront/catalog";
import { ctxFor, freshStore, key } from "./helpers";

const ISBN = "978-0-306-40615-7";
const cover = { path: "covers/x/img_1.webp", url: "/admin/media/covers/x/img_1.webp", alt: "Cover", width: 800, height: 1200, bytes: 40_000, contentType: "image/webp" };
const base = { pricePesewas: 9500, weightGrams: 300, active: true } as const;

function rejectsWith(code: AdminError["code"]) {
  return (error: unknown) => error instanceof AdminError && error.code === code;
}

async function book(store: ReturnType<typeof freshStore>) {
  const { result } = await createBook(store, ctxFor("catalogue_editor"), { title: "The Gruffalo", authors: ["Julia Donaldson"], description: "A mouse takes a stroll through the deep dark wood.", language: "English", ageBand: "4-7", categoryIds: ["fiction"], tags: [], relatedBookIds: [] }, key());
  return result.bookId;
}

describe("brand new and preloved variants", () => {
  it("labels options consistently, treating records without a condition as brand new", () => {
    assert.equal(conditionLabel(undefined), "Brand new");
    assert.equal(optionLabel("Paperback", "preloved", "very_good"), "Paperback · Preloved · Very good");
    assert.equal(optionLabel("Board book", "new"), "Board book · Brand new");
  });

  it("sells one ISBN brand new and preloved, but rejects a duplicate option", async () => {
    const store = freshStore();
    const editor = ctxFor("catalogue_editor");
    const bookId = await book(store);
    await createVariant(store, editor, bookId, { ...base, sku: "GRUF-PB-NEW", format: "Paperback", condition: "new", isbn: ISBN }, key());
    await createVariant(store, editor, bookId, { ...base, sku: "GRUF-PB-PL-VG", format: "Paperback", condition: "preloved", conditionGrade: "very_good", isbn: ISBN, pricePesewas: 4500 }, key());
    await createVariant(store, editor, bookId, { ...base, sku: "GRUF-PB-PL-G", format: "Paperback", condition: "preloved", conditionGrade: "good", isbn: ISBN, pricePesewas: 3500 }, key());
    await assert.rejects(createVariant(store, editor, bookId, { ...base, sku: "GRUF-PB-PL-VG2", format: "Paperback", condition: "preloved", conditionGrade: "very_good", isbn: ISBN }, key()), rejectsWith("conflict"), "same ISBN, format and grade → receive stock on the existing SKU instead");
  });

  it("requires a grade for preloved copies and clears grade and note when switched to brand new", async () => {
    const store = freshStore();
    const editor = ctxFor("catalogue_editor");
    const bookId = await book(store);
    await assert.rejects(createVariant(store, editor, bookId, { ...base, sku: "GRUF-PL", format: "Paperback", condition: "preloved" }, key()), rejectsWith("invalid"));
    await createVariant(store, editor, bookId, { ...base, sku: "GRUF-PL", format: "Paperback", condition: "preloved", conditionGrade: "good", conditionNote: "Name inside cover" }, key());
    await updateVariant(store, editor, "GRUF-PL", { ...base, format: "Paperback", condition: "new", conditionGrade: "good", conditionNote: "ignored" }, key());
    const variant = (await store.get("bookVariants", "GRUF-PL"))!;
    assert.equal(variant.condition, "new");
    assert.equal(variant.conditionGrade, undefined);
    assert.equal(variant.conditionNote, undefined);
  });

  it("shows both conditions on one public book and records the option on checkout lines", async () => {
    const store = freshStore();
    const editor = ctxFor("catalogue_editor");
    const bookId = await book(store);
    await createVariant(store, editor, bookId, { ...base, sku: "GRUF-PB-NEW", format: "Paperback", condition: "new" }, key());
    await createVariant(store, editor, bookId, { ...base, sku: "GRUF-PB-PL-VG", format: "Paperback", condition: "preloved", conditionGrade: "very_good", conditionNote: "Soft spine", pricePesewas: 4500 }, key());
    await receiveStock(store, editor, { sku: "GRUF-PB-NEW", quantity: 3, reference: "INV-1", idempotencyKey: key() });
    await receiveStock(store, editor, { sku: "GRUF-PB-PL-VG", quantity: 1, reference: "DONATION-1", idempotencyKey: key() });
    await setBookCover(store, editor, bookId, cover, key());
    await setBookStatus(store, editor, bookId, "published", key());

    const [publicBook] = await loadPublicCatalog(store);
    assert.deepEqual(publicBook.conditions, ["new", "preloved"]);
    assert.equal(publicBook.variants[0].label, "Paperback · Preloved · Very good", "cheapest first");
    assert.equal(publicBook.variants[0].conditionNote, "Soft spine");
    assert.equal(publicBook.variants[1].conditionGrade, undefined);

    const cart = await priceCart(store, [{ sku: "GRUF-PB-PL-VG", quantity: 1 }]);
    assert.equal(cart.lines[0].format, "Paperback · Preloved · Very good");
    assert.equal(cart.lines[0].condition, "preloved");
    assert.equal(cart.lines[0].conditionGrade, "very_good");
  });

  it("imports condition and grade columns, rejecting a preloved row without a grade", async () => {
    const store = freshStore();
    const csv = [
      "book_slug,title,authors,description,age_band,categories,sku,format,condition,grade,condition_note,price_ghs,weight_grams",
      "gruffalo,The Gruffalo,Julia Donaldson,A mouse in the wood,4-7,fiction,GRUF-NEW,Paperback,new,,,95,300",
      "gruffalo,The Gruffalo,Julia Donaldson,A mouse in the wood,4-7,fiction,GRUF-PL-VG,Paperback,Preloved,Very good,Name inside,45,300",
      "gruffalo,The Gruffalo,Julia Donaldson,A mouse in the wood,4-7,fiction,GRUF-PL-X,Paperback,preloved,,,40,300",
    ].join("\n");
    const plan = await dryRunImport(store, ctxFor("catalogue_editor"), csv);
    assert.equal(plan.rows[0].action, "create_book_and_variant");
    assert.equal(plan.rows[1].action, "add_variant_to_new_book");
    assert.equal(plan.rows[2].action, "error");
    assert.ok(plan.rows[2].errors.some((error) => error.startsWith("conditionGrade")));
  });
});

describe("shop shelves", () => {
  it("does not expose a hidden shelf through a published book", async () => {
    const store = freshStore();
    const editor = ctxFor("catalogue_editor");
    const bookId = await book(store);
    await createVariant(store, editor, bookId, { ...base, sku: "HIDDEN-BOOK", format: "Paperback", condition: "new" }, key());
    await setBookCover(store, editor, bookId, cover, key());
    await setBookStatus(store, editor, bookId, "published", key());
    const category = (await store.get("categories", "fiction"))!;
    store.seed("categories", "fiction", { ...category, published: false });
    const [publicBook] = await loadPublicCatalog(store);
    assert.deepEqual(publicBook.categories, []);
    assert.ok(publicBook, "the book remains available in Shop all");
  });

  it("keeps legacy adult listings out of the children’s storefront", async () => {
    const store = freshStore();
    const editor = ctxFor("catalogue_editor");
    const bookId = await book(store);
    await createVariant(store, editor, bookId, { ...base, sku: "LEGACY-ADULT", format: "Paperback", condition: "new" }, key());
    await setBookCover(store, editor, bookId, cover, key());
    await setBookStatus(store, editor, bookId, "published", key());
    const storedBook = (await store.get("books", bookId))!;
    store.seed("books", bookId, { ...storedBook, ageBand: "adult" as never });
    assert.deepEqual(await loadPublicCatalog(store), []);
  });
  it("shows the recommended shelves until any exist", async () => {
    const shelves = await loadPublicCategories(new MemoryAdminStore());
    assert.deepEqual(shelves.map((shelf) => shelf.slug), RECOMMENDED_CATEGORIES.map((category) => category.slug));
    assert.equal(shelves.length, 10);
    assert.equal(shelves.at(-1)?.slug, "bundles");
  });

  it("then lists only visible shelves, in admin order", async () => {
    const store = new MemoryAdminStore();
    const at = new Date().toISOString();
    store.seed("categories", "christian", { id: "christian", slug: "christian", name: "Christian Literature", order: 9, published: true, updatedAt: at });
    store.seed("categories", "baby-toddler", { id: "baby-toddler", slug: "baby-toddler", name: "Baby & Toddler Books", order: 1, published: true, updatedAt: at });
    store.seed("categories", "puzzles", { id: "puzzles", slug: "puzzles", name: "Puzzles", order: 2, published: false, updatedAt: at });
    const shelves = await loadPublicCategories(store);
    assert.deepEqual(shelves.map((shelf) => shelf.slug), ["baby-toddler", "christian"]);
  });
});
