import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signInDevelopment, resolveSession } from "@/lib/admin/auth/session";
import { AdminError } from "@/lib/admin/errors";
import { parseGhsToPesewas, pesewasToDecimal } from "@/lib/admin/format";
import { commitImport, dryRunImport } from "@/lib/admin/ops/catalogue-import";
import { createBook, createVariant, publishBlockers, setBookCover, setBookStatus, storefrontContractFor, updateBook } from "@/lib/admin/ops/catalogue";
import { createRate, quoteDelivery, reviseRate } from "@/lib/admin/ops/delivery";
import { adjustStock, receiveStock } from "@/lib/admin/ops/inventory";
import { listNotifications, retryNotification } from "@/lib/admin/ops/notifications";
import { approveManualPayment, createManualSale, requestRefund, transitionFulfilment } from "@/lib/admin/ops/orders";
import { salesReport } from "@/lib/admin/ops/reports";
import { changeStaffRole, setStaffStatus } from "@/lib/admin/ops/staff";
import { roleHas } from "@/lib/admin/permissions";
import { isValidIsbn } from "@/lib/admin/validation";
import { parseCsv, toCsv } from "@/lib/admin/csv";
import { FirebaseIdentityAdmin } from "@/lib/firebase/admin-adapters";
import type { AgeBand } from "@/lib/admin/types";
import type { Auth } from "firebase-admin/auth";
import { ctxFor, freshStore, key, seedWebsiteOrder } from "./helpers";

const cover = { path: "covers/x/img_1.webp", url: "/admin/media/covers/x/img_1.webp", alt: "Cover of Test Book", width: 800, height: 1200, bytes: 40_000, contentType: "image/webp" };

async function bookWithVariant(store: ReturnType<typeof freshStore>, sku = "TEST-PB-01") {
  const editor = ctxFor("catalogue_editor");
  const { result } = await createBook(store, editor, { title: "Test Book", authors: ["Ama Writer"], description: "A thoroughly tested description.", language: "English", ageBand: "8-12", categoryIds: ["fiction"], tags: [], relatedBookIds: [] }, key());
  await createVariant(store, editor, result.bookId, { sku, format: "Paperback", condition: "new", isbn: "978-0-306-40615-7", pricePesewas: 9500, weightGrams: 320, active: true }, key());
  return result.bookId;
}

function rejectsWith(code: AdminError["code"]) {
  return (error: unknown) => error instanceof AdminError && error.code === code;
}

describe("money and validation", () => {
  it("parses GHS to integer pesewas without floating point drift", () => {
    assert.equal(parseGhsToPesewas("95"), 9500);
    assert.equal(parseGhsToPesewas("0.10"), 10);
    assert.equal(parseGhsToPesewas("GH₵ 1,234.5"), 123450);
    assert.equal(parseGhsToPesewas("12.345"), null);
    assert.equal(pesewasToDecimal(123405), "1234.05");
  });
  it("validates ISBN check digits", () => {
    assert.ok(isValidIsbn("978-0-306-40615-7"));
    assert.ok(isValidIsbn("0-306-40615-2"));
    assert.ok(!isValidIsbn("978-0-306-40615-8"));
  });
  it("round-trips CSV with quotes and neutralises formulas", () => {
    const csv = toCsv(["a", "b"], [['He said "hi", ok', "=SUM(A1)"]]);
    assert.deepEqual(parseCsv(csv), [["a", "b"], ['He said "hi", ok', "'=SUM(A1)"]]);
  });
});

describe("permissions are enforced by operations, not the UI", () => {
  it("allows an unverified temporary staff email while still rejecting disabled and revoked accounts", async () => {
    const identityFor = (user: { disabled: boolean; emailVerified: boolean; tokensValidAfterTime?: string }) =>
      new FirebaseIdentityAdmin({ getUser: async () => user } as unknown as Auth);
    const unverified = { disabled: false, emailVerified: false };
    assert.equal(await identityFor(unverified).isRevokedOrDisabled("owner", 1_700_000_000), false);
    assert.equal(await identityFor({ ...unverified, disabled: true }).isRevokedOrDisabled("owner", 1_700_000_000), true);
    assert.equal(await identityFor({ ...unverified, tokensValidAfterTime: "2024-01-01T00:00:00.000Z" }).isRevokedOrDisabled("owner", 1_700_000_000), true);
  });
  it("denies a viewer and support role calling mutations directly", async () => {
    const store = freshStore();
    await assert.rejects(createBook(store, ctxFor("viewer"), { title: "X", authors: ["Y"], description: "", language: "English", ageBand: "8-12", categoryIds: [], tags: [], relatedBookIds: [] }, key()), rejectsWith("forbidden"));
    const bookId = await bookWithVariant(store);
    await assert.rejects(receiveStock(store, ctxFor("support"), { sku: "TEST-PB-01", quantity: 5, reference: "INV-1", idempotencyKey: key() }), rejectsWith("forbidden"));
    await assert.rejects(setBookStatus(store, ctxFor("fulfilment"), bookId, "published", key()), rejectsWith("forbidden"));
    await assert.rejects(requestRefund(store, ctxFor("fulfilment"), { orderId: "x", amountPesewas: 100, reason: "test", idempotencyKey: key() }), rejectsWith("forbidden"));
    assert.ok(!roleHas("manager", "staff.manage"));
  });
  it("prevents self-promotion and removing the last owner", async () => {
    const store = freshStore();
    await assert.rejects(changeStaffRole(store, ctxFor("owner"), "test-owner", "viewer", "testing", key()), rejectsWith("forbidden"));
    await assert.rejects(changeStaffRole(store, ctxFor("manager"), "test-manager", "owner", "promote me", key()), rejectsWith("forbidden"));
    const secondOwner = { ...ctxFor("owner"), uid: "other-owner" };
    await assert.rejects(setStaffStatus(store, secondOwner, "test-owner", "suspended", "testing last owner", key()), rejectsWith("precondition"));
  });
  it("ends sessions when a profile is suspended", async () => {
    process.env.BOOKISH_ADMIN_STORE = "memory";
    const store = freshStore();
    const { getDevelopmentIdentity } = await import("@/lib/admin/auth/identity");
    getDevelopmentIdentity().users.set("test-support", { uid: "test-support", email: "s@test.local", displayName: "S", staffClaim: true, disabled: false });
    const issued = await signInDevelopment(store, "test-support");
    assert.equal((await resolveSession(store, issued.cookieValue)).ok, true);
    assert.equal((await resolveSession(store, issued.cookieValue.replace(/.$/, "x"))).ok, false);
    await setStaffStatus(store, ctxFor("owner"), "test-support", "suspended", "left the company", key());
    const after = await resolveSession(store, issued.cookieValue);
    assert.equal(after.ok, false);
  });
});

describe("catalogue → storefront contract", () => {
  it("refuses an adult age band even if a crafted request bypasses the form", async () => {
    const store = freshStore();
    await assert.rejects(createBook(store, ctxFor("catalogue_editor"), { title: "Adult title", authors: ["A"], description: "A description long enough to publish.", language: "English", ageBand: "adult" as AgeBand, categoryIds: ["fiction"], tags: [], relatedBookIds: [] }, key()), rejectsWith("invalid"));
  });
  it("rejects missing categories and requires a visible shelf for publishing", async () => {
    const store = freshStore();
    const editor = ctxFor("catalogue_editor");
    const input = { title: "Test Book", authors: ["Ama Writer"], description: "A thoroughly tested description.", language: "English", ageBand: "8-12" as const, categoryIds: ["missing"], tags: [], relatedBookIds: [] };
    await assert.rejects(createBook(store, editor, input, key()), rejectsWith("invalid"));
    const bookId = await bookWithVariant(store);
    await assert.rejects(updateBook(store, editor, bookId, input, key()), rejectsWith("invalid"));
    const category = (await store.get("categories", "fiction"))!;
    store.seed("categories", "fiction", { ...category, published: false });
    await setBookCover(store, editor, bookId, cover, key());
    await assert.rejects(setBookStatus(store, editor, bookId, "published", key()), rejectsWith("precondition"));
  });
  it("adds a book and variant, receives opening stock via the ledger, uploads a cover and publishes", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    const inventory = await store.get("inventory", "TEST-PB-01");
    assert.equal(inventory?.onHand, 0, "variants start at zero");
    await assert.rejects(setBookStatus(store, ctxFor("catalogue_editor"), bookId, "published", key()), rejectsWith("precondition"), "no cover → cannot publish");
    await receiveStock(store, ctxFor("catalogue_editor"), { sku: "TEST-PB-01", quantity: 12, reference: "SUPPLIER-INV-77", idempotencyKey: key() });
    await setBookCover(store, ctxFor("catalogue_editor"), bookId, cover, key());
    await setBookStatus(store, ctxFor("catalogue_editor"), bookId, "published", key());
    const contract = await storefrontContractFor(store, ctxFor("viewer"), bookId);
    assert.ok(contract);
    assert.equal(contract.variants[0].available, 12);
    assert.equal(contract.variants[0].pricePesewas, 9500);
    assert.equal(contract.cover.alt, "Cover of Test Book");
    const movements = await store.query("stockMovements", { where: [["sku", "==", "TEST-PB-01"]] });
    assert.deepEqual(movements.map((movement) => movement.type), ["STOCK_RECEIVED"]);
    assert.equal(movements[0].onHandAfter, 12);
  });
  it("rejects duplicate SKUs and duplicate ISBN+format, permits a different format", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    const editor = ctxFor("catalogue_editor");
    await assert.rejects(createVariant(store, editor, bookId, { sku: "TEST-PB-01", format: "Hardcover", condition: "new", pricePesewas: 1, weightGrams: 1, active: true }, key()), rejectsWith("conflict"));
    await assert.rejects(createVariant(store, editor, bookId, { sku: "TEST-PB-02", format: "Paperback", condition: "new", isbn: "9780306406157", pricePesewas: 1, weightGrams: 1, active: true }, key()), rejectsWith("conflict"));
    await createVariant(store, editor, bookId, { sku: "TEST-HC-01", format: "Hardcover", condition: "new", isbn: "9780306406157", pricePesewas: 15000, weightGrams: 600, active: true }, key());
    assert.equal(publishBlockers((await store.get("books", bookId))!, await store.query("bookVariants")).includes("Upload a cover image."), true);
  });
});

describe("inventory concurrency and idempotency", () => {
  it("two concurrent removals cannot drive availability negative", async () => {
    const store = freshStore();
    await bookWithVariant(store);
    await receiveStock(store, ctxFor("owner"), { sku: "TEST-PB-01", quantity: 3, reference: "OPEN", idempotencyKey: key() });
    const results = await Promise.allSettled([
      adjustStock(store, ctxFor("fulfilment"), { sku: "TEST-PB-01", type: "ADJUST_DAMAGE", quantity: 2, reason: "water damage", reference: "COUNT-1", idempotencyKey: key() }),
      adjustStock(store, ctxFor("manager"), { sku: "TEST-PB-01", type: "OFFSITE_SALE", quantity: 2, reason: "sold at a fair", reference: "FAIR-1", idempotencyKey: key() }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const record = await store.get("inventory", "TEST-PB-01");
    assert.equal(record?.onHand, 1);
    const movements = await store.query("stockMovements", { where: [["sku", "==", "TEST-PB-01"]] });
    assert.equal(new Set(movements.map((movement) => movement.id)).size, movements.length, "movement IDs are unique");
  });
  it("a duplicate click with the same key is replayed, not re-applied", async () => {
    const store = freshStore();
    await bookWithVariant(store);
    const idempotencyKey = key();
    const input = { sku: "TEST-PB-01", quantity: 5, reference: "INV-9", idempotencyKey };
    const [first, second] = await Promise.all([receiveStock(store, ctxFor("owner"), input), receiveStock(store, ctxFor("owner"), input)]);
    assert.equal(first.replayed !== second.replayed, true);
    const third = await receiveStock(store, ctxFor("owner"), input);
    assert.equal(third.replayed, true);
    assert.equal((await store.get("inventory", "TEST-PB-01"))?.onHand, 5);
    assert.equal((await store.query("stockMovements")).length, 1);
  });
  it("cannot reduce on-hand below reserved stock", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    await receiveStock(store, ctxFor("owner"), { sku: "TEST-PB-01", quantity: 2, reference: "OPEN", idempotencyKey: key() });
    const record = (await store.get("inventory", "TEST-PB-01"))!;
    store.seed("inventory", "TEST-PB-01", { ...record, reserved: 2 });
    seedWebsiteOrder(store, { id: "ord_res", sku: "TEST-PB-01", bookId, quantity: 2, unitPricePesewas: 9500, paid: false });
    await assert.rejects(adjustStock(store, ctxFor("owner"), { sku: "TEST-PB-01", type: "ADJUST_DAMAGE", quantity: 1, reason: "torn cover", reference: "C-1", idempotencyKey: key() }), rejectsWith("precondition"));
  });
});

describe("orders and fulfilment", () => {
  it("a paid order moves new → picking → packed → dispatched → delivered with audit and one SMS per event", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    seedWebsiteOrder(store, { id: "ord_paid", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: true });
    const staff = ctxFor("fulfilment");
    await transitionFulfilment(store, staff, { orderId: "ord_paid", expectedFrom: "new", to: "picking", idempotencyKey: key() });
    await transitionFulfilment(store, staff, { orderId: "ord_paid", expectedFrom: "picking", to: "packed", idempotencyKey: key() });
    await assert.rejects(transitionFulfilment(store, staff, { orderId: "ord_paid", expectedFrom: "packed", to: "dispatched", idempotencyKey: key() }), rejectsWith("invalid"), "courier required");
    const dispatchKey = key();
    await transitionFulfilment(store, staff, { orderId: "ord_paid", expectedFrom: "packed", to: "dispatched", courier: "Test Courier", trackingReference: "TRK1", idempotencyKey: dispatchKey });
    const replay = await transitionFulfilment(store, staff, { orderId: "ord_paid", expectedFrom: "packed", to: "dispatched", courier: "Test Courier", idempotencyKey: dispatchKey });
    assert.equal(replay.replayed, true, "double-click on dispatch is a no-op");
    await assert.rejects(transitionFulfilment(store, staff, { orderId: "ord_paid", expectedFrom: "packed", to: "dispatched", courier: "Test Courier", idempotencyKey: key() }), rejectsWith("conflict"), "stale page cannot re-dispatch");
    await transitionFulfilment(store, staff, { orderId: "ord_paid", expectedFrom: "dispatched", to: "delivered", deliveryProofNote: "Signed by recipient", idempotencyKey: key() });
    const order = (await store.get("orders", "ord_paid"))!;
    assert.deepEqual(order.fulfilmentHistory.map((event) => event.to), ["new", "picking", "packed", "dispatched", "delivered"]);
    assert.ok(order.fulfilmentHistory.slice(1).every((event) => event.actorUid === staff.uid && event.at));
    assert.equal(order.paymentStatus, "paid", "fulfilment never changes payment state");
    const audit = await store.query("auditEvents", { where: [["entityId", "==", "ord_paid"]] });
    assert.equal(audit.length, 4);
    const sms = await store.query("notifications", { where: [["orderId", "==", "ord_paid"]] });
    assert.deepEqual(sms.map((record) => record.event).sort(), ["order_delivered", "order_dispatched"]);
  });
  it("an unpaid order cannot be picked or dispatched", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    seedWebsiteOrder(store, { id: "ord_unpaid", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: false });
    await assert.rejects(transitionFulfilment(store, ctxFor("owner"), { orderId: "ord_unpaid", expectedFrom: "new", to: "picking", idempotencyKey: key() }), rejectsWith("precondition"));
    const order = (await store.get("orders", "ord_unpaid"))!;
    store.seed("orders", "ord_unpaid", { ...order, fulfilmentStatus: "packed" });
    await assert.rejects(transitionFulfilment(store, ctxFor("owner"), { orderId: "ord_unpaid", expectedFrom: "packed", to: "dispatched", courier: "X", idempotencyKey: key() }), rejectsWith("precondition"));
  });
  it("cancelling an unpaid order releases its reservation; a paid order needs a refund first", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    await receiveStock(store, ctxFor("owner"), { sku: "TEST-PB-01", quantity: 4, reference: "OPEN", idempotencyKey: key() });
    const record = (await store.get("inventory", "TEST-PB-01"))!;
    store.seed("inventory", "TEST-PB-01", { ...record, reserved: 1 });
    seedWebsiteOrder(store, { id: "ord_cancel", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: false });
    await transitionFulfilment(store, ctxFor("manager"), { orderId: "ord_cancel", expectedFrom: "new", to: "cancelled", note: "Customer changed mind", idempotencyKey: key() });
    assert.equal((await store.get("inventory", "TEST-PB-01"))?.reserved, 0);
    seedWebsiteOrder(store, { id: "ord_paid_cancel", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: true });
    await assert.rejects(transitionFulfilment(store, ctxFor("manager"), { orderId: "ord_paid_cancel", expectedFrom: "new", to: "cancelled", note: "x", idempotencyKey: key() }), rejectsWith("precondition"));
  });
  it("records a Paystack refund request without forging payment state", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    seedWebsiteOrder(store, { id: "ord_refund", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: true });
    const outcome = await requestRefund(store, ctxFor("owner"), { orderId: "ord_refund", amountPesewas: 12000, reason: "Damaged in transit", idempotencyKey: key() });
    assert.equal(outcome.gateway, "not_connected");
    const order = (await store.get("orders", "ord_refund"))!;
    assert.equal(order.paymentStatus, "refund_pending", "not 'refunded' until Paystack confirms");
    const payment = (await store.get("payments", "pay_ord_refund"))!;
    assert.equal(payment.refunds[0].status, "requested");
    await assert.rejects(requestRefund(store, ctxFor("owner"), { orderId: "ord_refund", amountPesewas: 100, reason: "again", idempotencyKey: key() }), rejectsWith("precondition"));
  });
  it("manual sale uses the same stock ledger and needs approval before it counts as paid", async () => {
    const store = freshStore();
    await bookWithVariant(store);
    await receiveStock(store, ctxFor("owner"), { sku: "TEST-PB-01", quantity: 3, reference: "OPEN", idempotencyKey: key() });
    const sale = await createManualSale(store, ctxFor("fulfilment"), {
      manualChannel: "instagram",
      customer: { name: "IG Buyer", phone: "0241234567" },
      address: { region: "Greater Accra", city: "Accra", addressLine: "" },
      lines: [{ sku: "TEST-PB-01", quantity: 2 }],
      deliveryRateId: "pickup",
      payment: { method: "momo", evidence: "MOMO-TXN-123456", amountPesewas: 19000 },
      idempotencyKey: key(),
    });
    assert.equal(sale.result.approved, false);
    let order = (await store.get("orders", sale.result.orderId))!;
    assert.equal(order.paymentStatus, "pending");
    assert.equal((await store.get("inventory", "TEST-PB-01"))?.reserved, 2);
    await assert.rejects(transitionFulfilment(store, ctxFor("fulfilment"), { orderId: order.id, expectedFrom: "new", to: "picking", idempotencyKey: key() }), rejectsWith("precondition"));
    await assert.rejects(approveManualPayment(store, ctxFor("fulfilment"), order.id, key()), rejectsWith("forbidden"));
    await approveManualPayment(store, ctxFor("manager"), order.id, key());
    order = (await store.get("orders", sale.result.orderId))!;
    assert.equal(order.paymentStatus, "paid");
    const inventory = (await store.get("inventory", "TEST-PB-01"))!;
    assert.equal(inventory.onHand, 1);
    assert.equal(inventory.reserved, 0);
    await assert.rejects(approveManualPayment(store, ctxFor("manager"), "ord_x", key()), rejectsWith("not_found"));
  });
  it("website orders cannot be marked paid by staff", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    seedWebsiteOrder(store, { id: "ord_web", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: false });
    await assert.rejects(approveManualPayment(store, ctxFor("owner"), "ord_web", key()), rejectsWith("forbidden"));
  });
});

describe("delivery rates are versioned", () => {
  it("a rate edit creates a new version and leaves paid order totals untouched", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    const manager = ctxFor("manager");
    const base = { name: "Accra standard", region: "Greater Accra", cities: ["Accra"], serviceLevel: "standard" as const, minWeightGrams: 0, maxWeightGrams: 5000, minOrderPesewas: 0, pricePesewas: 2500, estimate: "1–2 working days", activeFrom: "2020-01-01T00:00:00.000Z" };
    const { result } = await createRate(store, manager, base, key());
    const order = seedWebsiteOrder(store, { id: "ord_rate", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: true, deliveryPesewas: 2500 });
    store.seed("orders", order.id, { ...order, delivery: { ...order.delivery, rateId: result.rateId, rateVersion: 1 } });
    const revised = await reviseRate(store, manager, result.rateId, { ...base, pricePesewas: 4000 }, key());
    const old = (await store.get("deliveryRates", result.rateId))!;
    const next = (await store.get("deliveryRates", revised.result.rateId))!;
    assert.equal(old.active, false);
    assert.equal(old.supersededBy, next.id);
    assert.equal(next.version, 2);
    const stored = (await store.get("orders", "ord_rate"))!;
    assert.equal(stored.totalPesewas, 12000);
    assert.equal(stored.delivery.pricePesewas, 2500);
    const quote = quoteDelivery(await store.query("deliveryRates"), { region: "Greater Accra", city: "accra", weightGrams: 300, orderPesewas: 9500 });
    assert.equal(quote[0].pricePesewas, 4000);
    await assert.rejects(reviseRate(store, manager, result.rateId, base, key()), rejectsWith("conflict"));
  });
});

describe("reports", () => {
  it("revenue totals exclude unpaid orders and are integer pesewas", async () => {
    const store = freshStore();
    const bookId = await bookWithVariant(store);
    seedWebsiteOrder(store, { id: "ord_r1", sku: "TEST-PB-01", bookId, quantity: 2, unitPricePesewas: 9550, paid: true, deliveryPesewas: 2501 });
    seedWebsiteOrder(store, { id: "ord_r2", sku: "TEST-PB-01", bookId, quantity: 1, unitPricePesewas: 9500, paid: false });
    const today = new Date().toISOString().slice(0, 10);
    const report = await salesReport(store, ctxFor("manager"), { from: today, to: today });
    assert.equal(report.totals.orders, 1);
    assert.equal(report.totals.grossPesewas, 9550 * 2 + 2501);
    assert.ok(Number.isInteger(report.totals.grossPesewas));
    assert.equal(report.excluded.count, 1);
    await assert.rejects(salesReport(store, ctxFor("fulfilment"), { from: today, to: today }), rejectsWith("forbidden"));
  });
});

describe("notifications", () => {
  it("only failed SMS can be retried, and recipients are masked", async () => {
    const store = freshStore();
    const at = new Date().toISOString();
    store.seed("notifications", "ntf_a", { id: "ntf_a", eventKey: "o1:order_paid", event: "order_paid", orderId: "o1", recipient: "+233241234567", template: "order_paid", templateVersion: 1, status: "failed", attempts: 1, createdAt: at, updatedAt: at });
    store.seed("notifications", "ntf_b", { id: "ntf_b", eventKey: "o2:order_paid", event: "order_paid", orderId: "o2", recipient: "+233241234568", template: "order_paid", templateVersion: 1, status: "sent", attempts: 1, createdAt: at, updatedAt: at });
    await retryNotification(store, ctxFor("support"), "ntf_a", key());
    assert.equal((await store.get("notifications", "ntf_a"))?.status, "queued");
    await assert.rejects(retryNotification(store, ctxFor("support"), "ntf_b", key()), rejectsWith("precondition"));
    await assert.rejects(retryNotification(store, ctxFor("viewer"), "ntf_a", key()), rejectsWith("forbidden"));
    const rows = await listNotifications(store, ctxFor("support"));
    assert.ok(rows.every((row) => !row.recipientMasked.includes("1234567")));
  });
});

describe("CSV import", () => {
  it("dry-runs, reports row errors, and commits only the confirmed file", async () => {
    const store = freshStore();
    const csv = [
      "book_slug,title,authors,description,age_band,categories,sku,format,isbn,price_ghs,weight_grams,opening_quantity,opening_reference",
      "imported-book,Imported Book,Kofi Author,Desc,8-12,fiction,IMP-PB-01,Paperback,9780306406157,95.00,300,4,INV-100",
      "imported-book,Imported Book,Kofi Author,Desc,8-12,fiction,IMP-HC-01,Hardcover,,150,600,,",
      "bad-book,Bad Book,Someone,Desc,8-12,nosuchcat,IMP-PB-01,Paperback,123,abc,300,,",
    ].join("\n");
    const plan = await dryRunImport(store, ctxFor("catalogue_editor"), csv);
    assert.equal(plan.rows[2].action, "error");
    assert.ok(plan.rows[2].errors.length >= 3);
    await assert.rejects(commitImport(store, ctxFor("catalogue_editor"), csv, plan.fileHash, key()), rejectsWith("precondition"));
    const good = csv.split("\n").slice(0, 3).join("\n");
    const goodPlan = await dryRunImport(store, ctxFor("catalogue_editor"), good);
    assert.equal(goodPlan.errorCount, 0);
    assert.equal(goodPlan.newBooks, 1);
    await assert.rejects(commitImport(store, ctxFor("catalogue_editor"), `${good}\n`, goodPlan.fileHash, key()), rejectsWith("conflict"), "a changed file needs a new dry run");
    const committed = await commitImport(store, ctxFor("catalogue_editor"), good, goodPlan.fileHash, key());
    assert.equal(committed.result.variants, 2);
    assert.equal((await store.get("inventory", "IMP-PB-01"))?.onHand, 4);
    const books = await store.query("books");
    assert.equal(books.length, 1);
    assert.equal(books[0].status, "draft", "imports never publish");
    await assert.rejects(dryRunImport(store, ctxFor("support"), good), rejectsWith("forbidden"));
  });
});
