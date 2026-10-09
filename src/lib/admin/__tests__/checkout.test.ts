import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AdminError } from "@/lib/admin/errors";
import { SCHEMA_VERSION } from "@/lib/admin/types";
import { applyPaystackOutcome, createPendingOrder, quoteCheckout, releaseExpiredOrder, type CheckoutInput } from "@/lib/commerce/checkout";
import { loadPublicCatalog } from "@/lib/storefront/catalog";
import { trackOrder } from "@/lib/storefront/order-tracking";
import { freshStore } from "./helpers";

const at = new Date().toISOString();

function shopStore({ checkout = true, onHand = 5 } = {}) {
  const store = freshStore();
  store.seed("siteSettings", "site", { id: "site", supportPhone: "", supportEmail: "", supportWhatsApp: "", fulfilmentOrigin: { region: "Ashanti", city: "Kumasi", addressLine: "" }, returnsPolicyUrl: "/returns", defaultLowStockThreshold: 3, checkoutEnabled: checkout, smsEnabled: true, maintenanceBanner: "", updatedAt: at, updatedBy: "test" });
  store.seed("categories", "puzzles", { id: "puzzles", slug: "puzzles", name: "Puzzles", order: 1, published: true, updatedAt: at });
  store.seed("books", "book_p", { id: "book_p", slug: "counting-puzzle", title: "Counting Puzzle", authors: [], description: "A thirty piece counting puzzle for young children.", language: "English", ageBand: "4-7", categoryIds: ["puzzles"], tags: [], gallery: [], relatedBookIds: [], status: "published", createdAt: at, updatedAt: at, updatedBy: "test", schemaVersion: SCHEMA_VERSION });
  store.seed("books", "book_d", { id: "book_d", slug: "draft-book", title: "Draft Book", authors: ["A"], description: "Not yet published to customers.", language: "English", ageBand: "4-7", categoryIds: [], tags: [], gallery: [], relatedBookIds: [], status: "draft", createdAt: at, updatedAt: at, updatedBy: "test", schemaVersion: SCHEMA_VERSION });
  store.seed("bookVariants", "PZ-1", { sku: "PZ-1", bookId: "book_p", format: "Board book", pricePesewas: 5000, costPesewas: 2000, weightGrams: 400, active: true, createdAt: at, updatedAt: at, updatedBy: "test", schemaVersion: SCHEMA_VERSION });
  store.seed("bookVariants", "DR-1", { sku: "DR-1", bookId: "book_d", format: "Paperback", pricePesewas: 3000, weightGrams: 200, active: true, createdAt: at, updatedAt: at, updatedBy: "test", schemaVersion: SCHEMA_VERSION });
  store.seed("inventory", "PZ-1", { sku: "PZ-1", onHand, reserved: 0, lowStockThreshold: 2, version: 1, updatedAt: at });
  store.seed("inventory", "DR-1", { sku: "DR-1", onHand: 9, reserved: 0, lowStockThreshold: 2, version: 1, updatedAt: at });
  store.seed("deliveryRates", "rate_ash", { id: "rate_ash", familyId: "rate_ash", version: 1, name: "Ashanti standard", region: "Ashanti", cities: [], serviceLevel: "standard", minWeightGrams: 0, maxWeightGrams: 5000, minOrderPesewas: 0, pricePesewas: 2000, estimate: "1–2 working days", activeFrom: "2020-01-01T00:00:00.000Z", active: true, createdAt: at, createdBy: "test" });
  return store;
}

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    lines: [{ sku: "PZ-1", quantity: 2 }],
    customer: { name: "Ama Mensah", phone: "024 123 4567" },
    address: { region: "Ashanti", city: "Kumasi", addressLine: "12 Lake Road, Atonsu" },
    deliveryRateId: "rate_ash",
    expectedTotalPesewas: 12000,
    ...overrides,
  };
}

async function inventoryOf(store: ReturnType<typeof shopStore>, sku = "PZ-1") {
  return (await store.get("inventory", sku))!;
}

describe("public catalogue", () => {
  it("lists only published items, with live availability and no cost price", async () => {
    const store = shopStore();
    const catalog = await loadPublicCatalog(store);
    assert.deepEqual(catalog.map((book) => book.slug), ["counting-puzzle"]);
    assert.equal(catalog[0].variant.available, 5);
    assert.deepEqual(catalog[0].categories, ["puzzles"]);
    assert.equal(catalog[0].label, "Ages 4–7");
    assert.equal(JSON.stringify(catalog).includes("costPesewas"), false);
  });
});

describe("website checkout", () => {
  it("quotes prices and delivery from the database", async () => {
    const quote = await quoteCheckout(shopStore(), { lines: [{ sku: "PZ-1", quantity: 2 }, { sku: "PZ-1", quantity: 1 }], region: "Ashanti", city: "Kumasi" });
    assert.equal(quote.cart.subtotalPesewas, 15000);
    assert.equal(quote.cart.lines[0].quantity, 3);
    assert.deepEqual(quote.options.map((option) => option.pricePesewas), [2000]);
  });

  it("reports unpublished or short-stock lines as problems", async () => {
    const quote = await quoteCheckout(shopStore({ onHand: 1 }), { lines: [{ sku: "PZ-1", quantity: 2 }, { sku: "DR-1", quantity: 1 }], region: "Ashanti", city: "Kumasi" });
    assert.equal(quote.cart.problems.length, 2);
  });

  it("refuses a saved bag item after its only public shelf is hidden", async () => {
    const store = shopStore();
    const category = (await store.get("categories", "puzzles"))!;
    store.seed("categories", "puzzles", { ...category, published: false });
    const quote = await quoteCheckout(store, { lines: [{ sku: "PZ-1", quantity: 1 }], region: "Ashanti", city: "Kumasi" });
    assert.equal(quote.cart.lines.length, 0);
    assert.equal(quote.cart.problems.length, 1);
  });

  it("creates a pending order and reserves stock", async () => {
    const store = shopStore();
    const pending = await createPendingOrder(store, input());
    assert.match(pending.ref, /^BD-/);
    assert.match(pending.paystackReference, /^BD-[A-Z0-9]{6}-[A-Z0-9]+$/);
    const order = (await store.get("orders", pending.orderId))!;
    assert.equal(order.paymentStatus, "pending");
    assert.equal(order.customer.phone, "+233241234567");
    assert.equal(order.totalPesewas, 12000);
    assert.ok(order.reservationExpiresAt);
    const record = await inventoryOf(store);
    assert.equal(record.onHand, 5);
    assert.equal(record.reserved, 2);
  });

  it("refuses when checkout is switched off, the total changed, or stock ran out", async () => {
    await assert.rejects(createPendingOrder(shopStore({ checkout: false }), input()), (error: unknown) => error instanceof AdminError && error.code === "precondition");
    await assert.rejects(createPendingOrder(shopStore(), input({ expectedTotalPesewas: 100 })), (error: unknown) => error instanceof AdminError && error.code === "conflict");
    await assert.rejects(createPendingOrder(shopStore({ onHand: 1 }), input()), (error: unknown) => error instanceof AdminError && error.code === "conflict");
  });

  it("marks the order paid once, sells the stock and queues one SMS", async () => {
    const store = shopStore();
    const pending = await createPendingOrder(store, input());
    const outcome = { reference: pending.paystackReference, status: "success", amountPesewas: 12000, currency: "GHS" };
    const first = await applyPaystackOutcome(store, outcome, "callback");
    const second = await applyPaystackOutcome(store, outcome, "webhook");
    assert.deepEqual([first.state, second.state], ["paid", "paid"]);
    assert.equal(second.state === "paid" && second.alreadyProcessed, true);
    const order = (await store.get("orders", pending.orderId))!;
    assert.equal(order.paymentStatus, "paid");
    assert.equal(order.stockState, "sold");
    const record = await inventoryOf(store);
    assert.deepEqual([record.onHand, record.reserved], [3, 0]);
    const sms = await store.query("notifications", { where: [["orderId", "==", pending.orderId]] });
    assert.equal(sms.length, 1);
    const tracked = await trackOrder(store, pending.ref, "0241234567");
    assert.equal(tracked.ok && tracked.order.paymentStatus, "paid");
  });

  it("flags an amount mismatch instead of fulfilling", async () => {
    const store = shopStore();
    const pending = await createPendingOrder(store, input());
    const outcome = { reference: pending.paystackReference, status: "success", amountPesewas: 100, currency: "GHS" };
    const first = await applyPaystackOutcome(store, outcome, "webhook");
    const repeated = await applyPaystackOutcome(store, outcome, "callback");
    assert.deepEqual([first.state, repeated.state], ["attention", "attention"]);
    const order = (await store.get("orders", pending.orderId))!;
    assert.equal(order.fulfilmentStatus, "exception");
    assert.equal(order.exception?.kind, "payment_mismatch");
    assert.equal(order.stockState, "released");
    assert.equal((await inventoryOf(store)).reserved, 0);
    assert.equal((await store.query("notifications", { where: [["orderId", "==", pending.orderId]] })).length, 0);
  });

  it("releases stock when payment fails", async () => {
    const store = shopStore();
    const pending = await createPendingOrder(store, input());
    const result = await applyPaystackOutcome(store, { reference: pending.paystackReference, status: "failed", amountPesewas: 12000, currency: "GHS" }, "callback");
    assert.equal(result.state, "failed");
    const order = (await store.get("orders", pending.orderId))!;
    assert.deepEqual([order.paymentStatus, order.fulfilmentStatus, order.stockState], ["failed", "cancelled", "released"]);
    assert.equal((await inventoryOf(store)).reserved, 0);
  });

  it("releases expired reservations, and still honours a late payment when stock remains", async () => {
    const store = shopStore();
    const pending = await createPendingOrder(store, input());
    const order = (await store.get("orders", pending.orderId))!;
    store.seed("orders", order.id, { ...order, reservationExpiresAt: "2000-01-01T00:00:00.000Z" });
    assert.equal(await releaseExpiredOrder(store, order.id), true);
    assert.equal((await inventoryOf(store)).reserved, 0);
    await applyPaystackOutcome(store, { reference: pending.paystackReference, status: "success", amountPesewas: 12000, currency: "GHS" }, "webhook");
    const paid = (await store.get("orders", pending.orderId))!;
    assert.deepEqual([paid.paymentStatus, paid.stockState, paid.fulfilmentStatus], ["paid", "sold", "new"]);
    const record = await inventoryOf(store);
    assert.deepEqual([record.onHand, record.reserved], [3, 0]);
  });
});
