import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AdminError } from "@/lib/admin/errors";
import { assembleBundles, maxAssemblable, unpackBundles } from "@/lib/admin/ops/bundles";
import { createBook, createVariant, setBookCover, setBookStatus, updateVariant } from "@/lib/admin/ops/catalogue";
import { receiveStock } from "@/lib/admin/ops/inventory";
import { loadPublicCatalog } from "@/lib/storefront/catalog";
import { ctxFor, freshStore, key } from "./helpers";

const cover = { path: "covers/x/img.webp", url: "/x.webp", alt: "Cover", width: 800, height: 1200, bytes: 1000, contentType: "image/webp" };

function rejectsWith(code: AdminError["code"]) {
  return (error: unknown) => error instanceof AdminError && error.code === code;
}

async function setup() {
  const store = freshStore();
  store.seed("categories", "bundles", { id: "bundles", slug: "bundles", name: "Bundle Deals", order: 8, published: true, updatedAt: new Date().toISOString() });
  const editor = ctxFor("catalogue_editor");
  const owner = ctxFor("owner");
  const newBook = async (title: string) =>
    (await createBook(store, editor, { title, authors: ["A"], description: "A description long enough to publish.", language: "English", ageBand: "4-7", categoryIds: ["fiction"], tags: [], relatedBookIds: [] }, key())).result.bookId;
  const phonics = await newBook("Phonics Set");
  const story = await newBook("Story Book");
  const bundleBook = await newBook("Starter Bundle");
  await createVariant(store, editor, phonics, { sku: "PHON-BOX", format: "Box set", condition: "new", pricePesewas: 11000, weightGrams: 300, active: true }, key());
  await createVariant(store, editor, story, { sku: "STORY-PL-VG", format: "Hardcover", condition: "preloved", conditionGrade: "very_good", pricePesewas: 6000, weightGrams: 450, active: true }, key());
  await receiveStock(store, owner, { sku: "PHON-BOX", quantity: 5, reference: "INV-1", idempotencyKey: key() });
  await receiveStock(store, owner, { sku: "STORY-PL-VG", quantity: 2, reference: "DONATION", idempotencyKey: key() });
  await createVariant(store, editor, bundleBook, {
    sku: "BUNDLE-STARTER",
    format: "Bundle",
    condition: "mixed",
    pricePesewas: 15000,
    compareAtPesewas: 17000,
    weightGrams: 750,
    active: true,
    bundleItems: [
      { sku: "PHON-BOX", title: "", quantity: 1 },
      { sku: "STORY-PL-VG", title: "", quantity: 1 },
      { title: "Bookmark", quantity: 2 },
    ],
  }, key());
  return { store, editor, owner, bundleBook };
}

describe("bundle deals", () => {
  it("publishes a bundle-only listing without a book type, and requires the Bundle Deals shelf", async () => {
    const store = freshStore();
    const editor = ctxFor("catalogue_editor");
    const { result } = await createBook(store, editor, { title: "Reading Pair", authors: [], description: "A reading pair for children to enjoy together.", language: "English", ageBand: "4-7", categoryIds: [], tags: [], relatedBookIds: [] }, key());
    await createVariant(store, editor, result.bookId, { sku: "PAIR-BUNDLE", format: "Bundle", condition: "new", pricePesewas: 12000, weightGrams: 500, active: true, bundleItems: [{ title: "Two books", quantity: 1 }] }, key());
    await setBookCover(store, editor, result.bookId, cover, key());
    await assert.rejects(setBookStatus(store, editor, result.bookId, "published", key()), rejectsWith("precondition"));
    store.seed("categories", "bundles", { id: "bundles", slug: "bundles", name: "Bundle Deals", order: 8, published: true, updatedAt: new Date().toISOString() });
    await setBookStatus(store, editor, result.bookId, "published", key());
    assert.deepEqual((await loadPublicCatalog(store))[0].categories, ["bundles"]);
  });

  it("fills linked titles, allows Mixed only for bundles and needs a worth above the price", async () => {
    const { store, editor, bundleBook } = await setup();
    const bundle = (await store.get("bookVariants", "BUNDLE-STARTER"))!;
    assert.deepEqual(bundle.bundleItems?.map((item) => item.title), ["Phonics Set", "Story Book", "Bookmark"]);
    await assert.rejects(createVariant(store, editor, bundleBook, { sku: "X-MIXED", format: "Paperback", condition: "mixed", pricePesewas: 100, weightGrams: 1, active: true }, key()), rejectsWith("invalid"));
    await assert.rejects(createVariant(store, editor, bundleBook, { sku: "X-WORTH", format: "Bundle", condition: "new", pricePesewas: 5000, compareAtPesewas: 4000, weightGrams: 1, active: true, bundleItems: [{ title: "A", quantity: 1 }] }, key()), rejectsWith("invalid"));
    await assert.rejects(createVariant(store, editor, bundleBook, { sku: "X-EMPTY", format: "Bundle", condition: "new", pricePesewas: 5000, weightGrams: 1, active: true, bundleItems: [] }, key()), rejectsWith("invalid"));
    await assert.rejects(createVariant(store, editor, bundleBook, { sku: "X-NESTED", format: "Bundle", condition: "new", pricePesewas: 5000, weightGrams: 1, active: true, bundleItems: [{ sku: "BUNDLE-STARTER", title: "", quantity: 1 }] }, key()), rejectsWith("invalid"));
  });

  it("making up bundles moves linked copies out of single stock, atomically and only once", async () => {
    const { store, owner } = await setup();
    const inventory = async (sku: string) => (await store.get("inventory", sku))!;
    assert.equal(maxAssemblable((await store.get("bookVariants", "BUNDLE-STARTER"))!, new Map([["PHON-BOX", await inventory("PHON-BOX")], ["STORY-PL-VG", await inventory("STORY-PL-VG")]])), 2);
    await assert.rejects(assembleBundles(store, owner, { bundleSku: "BUNDLE-STARTER", quantity: 3, reference: "Batch 1", idempotencyKey: key() }), rejectsWith("precondition"), "only 2 preloved copies");
    assert.equal((await inventory("PHON-BOX")).onHand, 5, "a refused make-up changes nothing");
    const idempotencyKey = key();
    await assembleBundles(store, owner, { bundleSku: "BUNDLE-STARTER", quantity: 2, reference: "Batch 1", idempotencyKey });
    const replay = await assembleBundles(store, owner, { bundleSku: "BUNDLE-STARTER", quantity: 2, reference: "Batch 1", idempotencyKey });
    assert.equal(replay.replayed, true);
    assert.equal((await inventory("BUNDLE-STARTER")).onHand, 2);
    assert.equal((await inventory("PHON-BOX")).onHand, 3);
    assert.equal((await inventory("STORY-PL-VG")).onHand, 0);
    const movements = await store.query("stockMovements", { where: [["type", "==", "BUNDLE_ASSEMBLED"]] });
    assert.equal(movements.length, 3);
  });

  it("unpacking returns the books, and linked contents can't change while bundles are made up", async () => {
    const { store, owner, editor } = await setup();
    await assembleBundles(store, owner, { bundleSku: "BUNDLE-STARTER", quantity: 2, reference: "Batch 1", idempotencyKey: key() });
    await assert.rejects(
      updateVariant(store, editor, "BUNDLE-STARTER", { format: "Bundle", condition: "mixed", pricePesewas: 15000, weightGrams: 750, active: true, bundleItems: [{ sku: "PHON-BOX", title: "", quantity: 2 }] }, key()),
      rejectsWith("precondition"),
    );
    await assert.rejects(unpackBundles(store, owner, { bundleSku: "BUNDLE-STARTER", quantity: 3, reference: "Too many", idempotencyKey: key() }), rejectsWith("precondition"));
    await unpackBundles(store, owner, { bundleSku: "BUNDLE-STARTER", quantity: 1, reference: "Customer wanted singles", idempotencyKey: key() });
    assert.equal((await store.get("inventory", "BUNDLE-STARTER"))!.onHand, 1);
    assert.equal((await store.get("inventory", "PHON-BOX"))!.onHand, 4);
    assert.equal((await store.get("inventory", "STORY-PL-VG"))!.onHand, 1);
    await assert.rejects(assembleBundles(store, ctxFor("catalogue_editor"), { bundleSku: "BUNDLE-STARTER", quantity: 1, reference: "x", idempotencyKey: key() }), rejectsWith("forbidden"));
  });

  it("publishes contents, worth and saving to the storefront", async () => {
    const { store, owner, editor, bundleBook } = await setup();
    await assembleBundles(store, owner, { bundleSku: "BUNDLE-STARTER", quantity: 1, reference: "Batch 1", idempotencyKey: key() });
    await setBookCover(store, editor, bundleBook, cover, key());
    await setBookStatus(store, editor, bundleBook, "published", key());
    const bundle = (await loadPublicCatalog(store)).find((book) => book.id === bundleBook)!;
    assert.deepEqual(bundle.conditions, ["mixed"]);
    assert.equal(bundle.variant.compareAtPesewas, 17000);
    assert.equal(bundle.variant.label, "Bundle · Mixed: new & preloved");
    assert.equal(bundle.variant.available, 1);
    assert.deepEqual(bundle.variant.bundleItems?.map((item) => item.detail ?? null), ["Box set · Brand new", "Hardcover · Preloved · Very good", null], "linked items say exactly what they are");
  });
});
