import { recordAudit } from "@/lib/admin/audit";
import { assertPermission, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { derivedId } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import { applyMovement, availableOf } from "@/lib/admin/ops/inventory";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";
import type { BookVariant, BundleItem, InventoryRecord } from "@/lib/admin/types";

/**
 * Bundle stock.
 *
 * A bundle is its own variant (format "Bundle") with its own SKU and stock.
 * When its contents are linked to SKUs you also sell singly, staff "make up"
 * bundles: in one transaction the linked copies leave single-item stock and
 * the bundle's stock goes up, both as BUNDLE_ASSEMBLED ledger entries. So a
 * book can never be sold on its own and inside a bundle at the same time.
 * "Unpack" reverses it (BUNDLE_UNPACKED). Contents without a SKU are
 * descriptive only; their stock is not tracked.
 */

export function linkedItems(bundle: Pick<BookVariant, "bundleItems">): (BundleItem & { sku: string })[] {
  return (bundle.bundleItems ?? []).filter((item): item is BundleItem & { sku: string } => Boolean(item.sku));
}

/** How many more bundles the current single-item stock allows. */
export function maxAssemblable(bundle: Pick<BookVariant, "bundleItems">, inventory: Map<string, Pick<InventoryRecord, "onHand" | "reserved">>): number {
  const items = linkedItems(bundle);
  if (!items.length) return 0;
  return Math.max(0, Math.min(...items.map((item) => {
    const record = inventory.get(item.sku);
    return record ? Math.floor(availableOf(record) / item.quantity) : 0;
  })));
}

interface BundleStockInput {
  bundleSku: string;
  quantity: number;
  reference: string;
  idempotencyKey: string;
}

async function load(tx: AdminTransaction, bundleSku: string) {
  const bundle = await tx.get("bookVariants", bundleSku);
  if (!bundle) throw new AdminError("not_found", "Bundle not found.");
  if (bundle.format !== "Bundle") throw new AdminError("precondition", `${bundleSku} is not a bundle.`);
  const items = linkedItems(bundle);
  if (!items.length) throw new AdminError("precondition", "Nothing in this bundle is linked to a stocked SKU, so there is nothing to move. Receive the bundle’s stock directly instead.");
  const bundleInventory = await tx.get("inventory", bundleSku);
  if (!bundleInventory) throw new AdminError("not_found", `No inventory record for ${bundleSku}.`);
  const components = new Map<string, InventoryRecord>();
  for (const item of items) {
    const record = await tx.get("inventory", item.sku);
    if (!record) throw new AdminError("not_found", `No inventory record for ${item.sku}.`);
    components.set(item.sku, record);
  }
  return { bundle, items, bundleInventory, components };
}

function checkQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new AdminError("invalid", "Enter how many bundles, 1–500.", { quantity: "1–500" });
}

function checkReference(reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.length < 2 || trimmed.length > 120) throw new AdminError("invalid", "Add a reference, e.g. a date or batch name.", { reference: "Required" });
  return trimmed;
}

export async function assembleBundles(store: AdminDataStore, ctx: StaffContext, input: BundleStockInput) {
  assertPermission(ctx, "inventory.adjust");
  checkQuantity(input.quantity);
  const reference = checkReference(input.reference);
  return runIdempotent(store, ctx, "bundles.assemble", input.idempotencyKey, async (tx) => {
    const { bundle, items, bundleInventory, components } = await load(tx, input.bundleSku);
    const short = items.filter((item) => availableOf(components.get(item.sku)!) < item.quantity * input.quantity);
    if (short.length) {
      const max = maxAssemblable(bundle, components);
      throw new AdminError("precondition", `Not enough single stock: ${short.map((item) => `${item.sku} has ${availableOf(components.get(item.sku)!)} available, needs ${item.quantity * input.quantity}`).join("; ")}. You can make up ${max} now.`, { quantity: `Max ${max}` });
    }
    for (const item of items) {
      applyMovement(tx, ctx, components.get(item.sku)!, { sku: item.sku, type: "BUNDLE_ASSEMBLED", onHandDelta: -item.quantity * input.quantity, reservedDelta: 0, reason: `Made into ${input.quantity} × bundle ${bundle.sku}`, reference }, derivedId("mov", "bundle", ctx.uid, input.idempotencyKey, item.sku));
    }
    const next = applyMovement(tx, ctx, bundleInventory, { sku: bundle.sku, type: "BUNDLE_ASSEMBLED", onHandDelta: input.quantity, reservedDelta: 0, reason: `Made up from ${items.map((item) => `${item.quantity}× ${item.sku}`).join(", ")}`, reference }, derivedId("mov", "bundle", ctx.uid, input.idempotencyKey, bundle.sku));
    recordAudit(tx, ctx, { action: "inventory.bundle.assemble", entityType: "inventory", entityId: bundle.sku, summary: `Made up ${input.quantity} × ${bundle.sku}`, reason: reference, after: { onHand: next.onHand } });
    return { bundleSku: bundle.sku, onHand: next.onHand };
  });
}

export async function unpackBundles(store: AdminDataStore, ctx: StaffContext, input: BundleStockInput) {
  assertPermission(ctx, "inventory.adjust");
  checkQuantity(input.quantity);
  const reference = checkReference(input.reference);
  return runIdempotent(store, ctx, "bundles.unpack", input.idempotencyKey, async (tx) => {
    const { bundle, items, bundleInventory, components } = await load(tx, input.bundleSku);
    if (availableOf(bundleInventory) < input.quantity) {
      throw new AdminError("precondition", `Only ${Math.max(0, availableOf(bundleInventory))} made-up bundle(s) are available to unpack (others may be reserved for orders).`, { quantity: `Max ${Math.max(0, availableOf(bundleInventory))}` });
    }
    const next = applyMovement(tx, ctx, bundleInventory, { sku: bundle.sku, type: "BUNDLE_UNPACKED", onHandDelta: -input.quantity, reservedDelta: 0, reason: "Bundle unpacked back to single items", reference }, derivedId("mov", "unbundle", ctx.uid, input.idempotencyKey, bundle.sku));
    for (const item of items) {
      applyMovement(tx, ctx, components.get(item.sku)!, { sku: item.sku, type: "BUNDLE_UNPACKED", onHandDelta: item.quantity * input.quantity, reservedDelta: 0, reason: `Returned from ${input.quantity} × bundle ${bundle.sku}`, reference }, derivedId("mov", "unbundle", ctx.uid, input.idempotencyKey, item.sku));
    }
    recordAudit(tx, ctx, { action: "inventory.bundle.unpack", entityType: "inventory", entityId: bundle.sku, summary: `Unpacked ${input.quantity} × ${bundle.sku}`, reason: reference, after: { onHand: next.onHand } });
    return { bundleSku: bundle.sku, onHand: next.onHand };
  });
}
