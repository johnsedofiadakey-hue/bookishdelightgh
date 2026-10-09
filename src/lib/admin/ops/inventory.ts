import { pick, recordAudit } from "@/lib/admin/audit";
import { assertPermission, can, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { derivedId, nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import { optionLabel } from "@/lib/contracts/catalog";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";
import type { Book, BookVariant, InventoryRecord, MovementType, StockMovement } from "@/lib/admin/types";

/**
 * Inventory is changed only here, only inside transactions, and only by
 * appending a StockMovement alongside the new counters.
 *
 * Invariants enforced on every movement:
 *   onHand >= 0, reserved >= 0, onHand - reserved (available) >= 0.
 */

export interface MovementInput {
  sku: string;
  type: MovementType;
  onHandDelta: number;
  reservedDelta: number;
  reason: string;
  reference: string;
  orderId?: string;
}

export function availableOf(record: Pick<InventoryRecord, "onHand" | "reserved">): number {
  return record.onHand - record.reserved;
}

export type StockState = "in_stock" | "low" | "out";

export function stockState(record: Pick<InventoryRecord, "onHand" | "reserved" | "lowStockThreshold">): StockState {
  const available = availableOf(record);
  if (available <= 0) return "out";
  if (available <= record.lowStockThreshold) return "low";
  return "in_stock";
}

/**
 * Apply one movement to an inventory record that was already read in `tx`.
 * Returns the updated record so callers that touch the same SKU twice in one
 * transaction can chain without re-reading.
 */
export function applyMovement(tx: AdminTransaction, ctx: StaffContext, inventory: InventoryRecord, input: MovementInput, movementId: string): InventoryRecord {
  if (!Number.isInteger(input.onHandDelta) || !Number.isInteger(input.reservedDelta)) throw new AdminError("invalid", "Stock quantities must be whole numbers.");
  const onHandAfter = inventory.onHand + input.onHandDelta;
  const reservedAfter = inventory.reserved + input.reservedDelta;
  if (onHandAfter < 0) throw new AdminError("precondition", `${input.sku}: this would make on-hand stock negative (${onHandAfter}).`);
  if (reservedAfter < 0) throw new AdminError("precondition", `${input.sku}: this would make reserved stock negative.`);
  if (onHandAfter < reservedAfter) {
    throw new AdminError("precondition", `${input.sku}: ${inventory.reserved} copies are reserved for unpaid or unshipped orders; on-hand cannot drop below that.`);
  }
  const at = nowIso();
  const movement: StockMovement = {
    id: movementId,
    sku: input.sku,
    type: input.type,
    onHandDelta: input.onHandDelta,
    reservedDelta: input.reservedDelta,
    onHandAfter,
    reservedAfter,
    reason: input.reason,
    reference: input.reference,
    actorUid: ctx.uid,
    actorName: ctx.name,
    createdAt: at,
    ...(input.orderId ? { orderId: input.orderId } : {}),
  };
  tx.create("stockMovements", movementId, movement);
  const next: InventoryRecord = { ...inventory, onHand: onHandAfter, reserved: reservedAfter, version: inventory.version + 1, updatedAt: at };
  tx.set("inventory", inventory.sku, next);
  return next;
}

async function readInventory(tx: AdminTransaction, sku: string): Promise<InventoryRecord> {
  const record = await tx.get("inventory", sku);
  if (!record) throw new AdminError("not_found", `No inventory record for ${sku}. Create the variant first.`);
  return record;
}

function requireReference(reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.length < 2 || trimmed.length > 120) throw new AdminError("invalid", "Add a reference (supplier invoice, delivery note, count sheet…).", { reference: "Required" });
  return trimmed;
}

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 4 || trimmed.length > 500) throw new AdminError("invalid", "Explain the reason for this change.", { reason: "Required (at least 4 characters)" });
  return trimmed;
}

export interface ReceiveStockInput {
  sku: string;
  quantity: number;
  reference: string;
  note?: string;
  idempotencyKey: string;
}

export async function receiveStock(store: AdminDataStore, ctx: StaffContext, input: ReceiveStockInput) {
  assertPermission(ctx, "inventory.receive");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10_000) {
    throw new AdminError("invalid", "Received quantity must be a whole number between 1 and 10,000.", { quantity: "1–10,000" });
  }
  const reference = requireReference(input.reference);
  return runIdempotent(store, ctx, "inventory.receive", input.idempotencyKey, async (tx) => {
    const variant = await tx.get("bookVariants", input.sku);
    if (!variant) throw new AdminError("not_found", `Variant ${input.sku} does not exist.`);
    const inventory = await readInventory(tx, input.sku);
    const movementId = derivedId("mov", "receive", ctx.uid, input.idempotencyKey);
    const next = applyMovement(tx, ctx, inventory, { sku: input.sku, type: "STOCK_RECEIVED", onHandDelta: input.quantity, reservedDelta: 0, reason: input.note?.trim() || "Stock received", reference }, movementId);
    recordAudit(tx, ctx, {
      action: "inventory.receive",
      entityType: "inventory",
      entityId: input.sku,
      summary: `Received ${input.quantity} × ${input.sku}`,
      before: pick(inventory, ["onHand", "reserved"]),
      after: pick(next, ["onHand", "reserved"]),
      reason: reference,
    });
    return { movementId, onHand: next.onHand, available: availableOf(next) };
  });
}

export const ADJUSTMENT_TYPES = ["ADJUST_DAMAGE", "ADJUST_CORRECTION", "RETURN_TO_STOCK", "OFFSITE_SALE"] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  ADJUST_DAMAGE: "Damaged / unsellable (removes stock)",
  ADJUST_CORRECTION: "Count correction (+ or −)",
  RETURN_TO_STOCK: "Return to stock (adds stock)",
  OFFSITE_SALE: "Untracked offsite sale (removes stock)",
};

export interface AdjustStockInput {
  sku: string;
  type: AdjustmentType;
  /** Positive count for damage/return/offsite; signed for correction. */
  quantity: number;
  reason: string;
  reference: string;
  idempotencyKey: string;
}

export function adjustmentDelta(type: AdjustmentType, quantity: number): number {
  switch (type) {
    case "ADJUST_DAMAGE":
    case "OFFSITE_SALE":
      return -Math.abs(quantity);
    case "RETURN_TO_STOCK":
      return Math.abs(quantity);
    case "ADJUST_CORRECTION":
      return quantity;
  }
}

export async function adjustStock(store: AdminDataStore, ctx: StaffContext, input: AdjustStockInput) {
  assertPermission(ctx, "inventory.adjust");
  if (!(ADJUSTMENT_TYPES as readonly string[]).includes(input.type)) throw new AdminError("invalid", "Choose an adjustment type.");
  if (!Number.isInteger(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 10_000) {
    throw new AdminError("invalid", "Quantity must be a non-zero whole number up to 10,000.", { quantity: "Non-zero whole number" });
  }
  if (input.type !== "ADJUST_CORRECTION" && input.quantity < 0) throw new AdminError("invalid", "Enter a positive quantity; the adjustment type sets the direction.", { quantity: "Positive number" });
  const reason = requireReason(input.reason);
  const reference = requireReference(input.reference);
  const delta = adjustmentDelta(input.type, input.quantity);
  return runIdempotent(store, ctx, "inventory.adjust", input.idempotencyKey, async (tx) => {
    const inventory = await readInventory(tx, input.sku);
    const movementId = derivedId("mov", "adjust", ctx.uid, input.idempotencyKey);
    const next = applyMovement(tx, ctx, inventory, { sku: input.sku, type: input.type, onHandDelta: delta, reservedDelta: 0, reason, reference }, movementId);
    recordAudit(tx, ctx, {
      action: "inventory.adjust",
      entityType: "inventory",
      entityId: input.sku,
      summary: `${input.type} ${delta > 0 ? "+" : ""}${delta} × ${input.sku}`,
      reason,
      before: pick(inventory, ["onHand", "reserved"]),
      after: pick(next, ["onHand", "reserved"]),
    });
    return { movementId, onHand: next.onHand, available: availableOf(next) };
  });
}

export async function setLowStockThreshold(store: AdminDataStore, ctx: StaffContext, sku: string, threshold: number, idempotencyKey: string) {
  assertPermission(ctx, "inventory.adjust");
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 1000) throw new AdminError("invalid", "Threshold must be 0–1000.", { threshold: "0–1000" });
  return runIdempotent(store, ctx, "inventory.threshold", idempotencyKey, async (tx) => {
    const inventory = await readInventory(tx, sku);
    tx.update("inventory", sku, { lowStockThreshold: threshold, version: inventory.version + 1, updatedAt: nowIso() });
    recordAudit(tx, ctx, { action: "inventory.threshold", entityType: "inventory", entityId: sku, summary: `Low-stock threshold ${inventory.lowStockThreshold} → ${threshold}` });
    return { sku, threshold };
  });
}

/* ----------------------------------------------------------------- Reads */

export interface InventoryRow {
  sku: string;
  bookId: string;
  title: string;
  format: string;
  isbn?: string;
  active: boolean;
  bookStatus: Book["status"];
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  state: StockState;
  pricePesewas: number;
  /** Present only for roles with `finance.view`. */
  costPesewas?: number;
  updatedAt: string;
}

export async function listInventory(store: AdminDataStore, ctx: StaffContext): Promise<InventoryRow[]> {
  assertPermission(ctx, "inventory.view");
  const [records, variants, books] = await Promise.all([store.query("inventory"), store.query("bookVariants"), store.query("books")]);
  const variantBySku = new Map(variants.map((variant) => [variant.sku, variant]));
  const bookById = new Map(books.map((book) => [book.id, book]));
  const showCost = can(ctx, "finance.view");
  return records
    .flatMap((record) => {
      const variant = variantBySku.get(record.sku);
      if (!variant) return [];
      const book = bookById.get(variant.bookId);
      return [
        {
          sku: record.sku,
          bookId: variant.bookId,
          title: book?.title ?? "(missing book)",
          format: optionLabel(variant.format, variant.condition, variant.conditionGrade) + (variant.edition ? ` · ${variant.edition}` : ""),
          isbn: variant.isbn,
          active: variant.active,
          bookStatus: book?.status ?? "draft",
          onHand: record.onHand,
          reserved: record.reserved,
          available: availableOf(record),
          lowStockThreshold: record.lowStockThreshold,
          state: stockState(record),
          pricePesewas: variant.pricePesewas,
          ...(showCost && variant.costPesewas !== undefined ? { costPesewas: variant.costPesewas } : {}),
          updatedAt: record.updatedAt,
        } satisfies InventoryRow,
      ];
    })
    .sort((left, right) => left.title.localeCompare(right.title) || left.sku.localeCompare(right.sku));
}

export async function movementsForSku(store: AdminDataStore, ctx: StaffContext, sku: string, limit = 200): Promise<StockMovement[]> {
  assertPermission(ctx, "inventory.view");
  return store.query("stockMovements", { where: [["sku", "==", sku]], orderBy: { field: "createdAt", direction: "desc" }, limit });
}

export async function inventoryDetail(store: AdminDataStore, ctx: StaffContext, sku: string): Promise<{ record: InventoryRecord; variant: BookVariant; book: Book | null } | null> {
  assertPermission(ctx, "inventory.view");
  const [record, variant] = await Promise.all([store.get("inventory", sku), store.get("bookVariants", sku)]);
  if (!record || !variant) return null;
  const book = await store.get("books", variant.bookId);
  const safeVariant = can(ctx, "finance.view") ? variant : { ...variant, costPesewas: undefined };
  return { record, variant: safeVariant, book };
}
