import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOrderRef, trackOrder } from "@/lib/storefront/order-tracking";
import { freshStore, seedWebsiteOrder } from "./helpers";

function storeWithOrder() {
  const store = freshStore();
  seedWebsiteOrder(store, { id: "ord_track2", sku: "SKU-1", bookId: "book_1", quantity: 2, unitPricePesewas: 5000, paid: true });
  return store;
}

describe("customer order tracking", () => {
  it("normalises order references typed in different ways", () => {
    assert.equal(normalizeOrderRef(" bd-track2 "), "BD-TRACK2");
    assert.equal(normalizeOrderRef("BDTRACK2"), "BD-TRACK2");
    assert.equal(normalizeOrderRef("track2"), "BD-TRACK2");
    assert.equal(normalizeOrderRef("BD-TRACK0"), null);
    assert.equal(normalizeOrderRef("BD-12"), null);
  });

  it("finds an order with the matching reference and local phone format", async () => {
    const result = await trackOrder(storeWithOrder(), "bd-track2", "020 000 0099");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.order.ref, "BD-TRACK2");
    assert.equal(result.order.paymentStatus, "paid");
    assert.equal(result.order.fulfilmentStatus, "new");
    assert.equal(result.order.destination, "Accra, Greater Accra");
    assert.deepEqual(result.order.items, [{ title: "Test Book", format: "Paperback", quantity: 2 }]);
  });

  it("does not expose personal details or staff names", async () => {
    const result = await trackOrder(storeWithOrder(), "BD-TRACK2", "+233200000099");
    assert.equal(result.ok, true);
    const json = JSON.stringify(result);
    for (const secret of ["Test Customer", "200000099", "customer@test.local", "Test address", "Checkout", "PSK-", "staffNotes"]) {
      assert.equal(json.includes(secret), false, `leaked ${secret}`);
    }
  });

  it("returns the same not-found result for a wrong phone or unknown reference", async () => {
    const store = storeWithOrder();
    assert.deepEqual(await trackOrder(store, "BD-TRACK2", "0240000000"), { ok: false, reason: "not_found" });
    assert.deepEqual(await trackOrder(store, "BD-ZZZZZZ", "0200000099"), { ok: false, reason: "not_found" });
  });

  it("rejects malformed input before querying", async () => {
    assert.deepEqual(await trackOrder(storeWithOrder(), "hello", "0200000099"), { ok: false, reason: "invalid" });
    assert.deepEqual(await trackOrder(storeWithOrder(), "BD-TRACK2", "12345"), { ok: false, reason: "invalid" });
  });
});
