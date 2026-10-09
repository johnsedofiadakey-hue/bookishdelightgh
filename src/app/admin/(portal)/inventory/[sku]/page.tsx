import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/action-form";
import { Badge, Card, EmptyState, PageHeader, PermissionDenied, Stat, StockBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDateTime } from "@/lib/admin/format";
import { ADJUSTMENT_LABELS, ADJUSTMENT_TYPES, availableOf, inventoryDetail, movementsForSku } from "@/lib/admin/ops/inventory";
import { getAdminStore } from "@/lib/admin/store";
import type { MovementType } from "@/lib/admin/types";
import { adjustStockAction, receiveStockAction, thresholdAction } from "../actions";

export const metadata = { title: "Stock ledger" };

const MOVEMENT_LABELS: Record<MovementType, string> = {
  STOCK_RECEIVED: "Received",
  ADJUST_DAMAGE: "Damaged",
  ADJUST_CORRECTION: "Correction",
  RETURN_TO_STOCK: "Returned to stock",
  OFFSITE_SALE: "Offsite sale",
  ORDER_RESERVED: "Reserved for order",
  ORDER_RELEASED: "Reservation released",
  ORDER_SOLD: "Sold",
  ORDER_CANCELLED_RESTOCK: "Order restocked",
};

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export default async function SkuPage({ params }: { params: Promise<{ sku: string }> }) {
  const access = await pageAccess("inventory.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const sku = decodeURIComponent((await params).sku);
  const store = getAdminStore();
  const detail = await inventoryDetail(store, ctx, sku);
  if (!detail) notFound();
  const { record, variant, book } = detail;
  const movements = await movementsForSku(store, ctx, sku);
  const available = availableOf(record);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/inventory", label: "Inventory" }, ...(book ? [{ href: `/admin/catalogue/${book.id}`, label: book.title }] : [])]}
        eyebrow={`${variant.format}${variant.edition ? ` · ${variant.edition}` : ""}${variant.isbn ? ` · ISBN ${variant.isbn}` : ""}`}
        title={<span className="adm-mono" style={{ fontFamily: "var(--mono)", fontSize: "0.8em" }}>{sku}</span>}
        lede={<>{book?.title} <StockBadge available={available} threshold={record.lowStockThreshold} /> {!variant.active ? <Badge>Inactive variant</Badge> : null}</>}
      />
      <div className="adm-stats">
        <Stat label="On hand" value={record.onHand} />
        <Stat label="Reserved" value={record.reserved} note="Unpaid or unshipped orders" />
        <Stat label="Available to sell" value={available} tone={available <= record.lowStockThreshold ? "alert" : "calm"} />
        <Stat label="Low-stock threshold" value={record.lowStockThreshold} />
      </div>

      <div className="adm-grid adm-grid-main">
        <Card title="Stock ledger" description="Append-only. Movements cannot be edited or deleted; corrections are new entries.">
          {movements.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table" data-stack>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Movement</th>
                    <th className="num">On hand</th>
                    <th className="num">Reserved</th>
                    <th>Reference</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="nowrap" data-label="When">{formatDateTime(movement.createdAt)}</td>
                      <td className="primary" data-label="Movement">
                        <strong>{MOVEMENT_LABELS[movement.type]}</strong>
                        <span className="sub">{movement.reason}</span>
                      </td>
                      <td className="num" data-label="On hand">{movement.onHandDelta ? signed(movement.onHandDelta) : "·"} <span className="sub">→ {movement.onHandAfter}</span></td>
                      <td className="num" data-label="Reserved">{movement.reservedDelta ? signed(movement.reservedDelta) : "·"} <span className="sub">→ {movement.reservedAfter}</span></td>
                      <td data-label="Reference">{movement.orderId ? <Link className="adm-link adm-mono" href={`/admin/orders/${movement.orderId}`}>{movement.reference}</Link> : <span className="adm-mono">{movement.reference}</span>}</td>
                      <td data-label="By">{movement.actorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No movements yet" art="0">This SKU starts at zero. Receive its opening stock to make it sellable.</EmptyState>
          )}
        </Card>

        <div className="adm-stack">
          {can(ctx, "inventory.receive") ? (
            <Card title="Receive stock" description="Adds to on-hand with a STOCK_RECEIVED entry.">
              <ActionForm action={receiveStockAction} idempotencyKey={randomUUID()} submitLabel="Record receipt" variant="coral" resetOnSuccess>
                <input type="hidden" name="sku" value={sku} />
                <div className="adm-fields">
                  <Field name="quantity" label="Quantity" required>
                    <input type="number" name="quantity" min={1} max={10000} step={1} required />
                  </Field>
                  <Field name="reference" label="Reference" required hint="Supplier invoice or delivery note">
                    <input type="text" name="reference" maxLength={120} required />
                  </Field>
                  <Field name="note" label="Note" wide>
                    <input type="text" name="note" maxLength={300} placeholder="Optional" />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          ) : null}
          {can(ctx, "inventory.adjust") ? (
            <>
              <Card title="Adjust stock" description="Requires a reason and reference. Cannot go below reserved stock.">
                <ActionForm action={adjustStockAction} idempotencyKey={randomUUID()} submitLabel="Record adjustment" resetOnSuccess>
                  <input type="hidden" name="sku" value={sku} />
                  <div className="adm-fields">
                    <Field name="type" label="Type" required wide>
                      <select name="type" defaultValue="ADJUST_CORRECTION">
                        {ADJUSTMENT_TYPES.map((type) => <option key={type} value={type}>{ADJUSTMENT_LABELS[type]}</option>)}
                      </select>
                    </Field>
                    <Field name="quantity" label="Quantity" required hint="Corrections may be negative, e.g. −2">
                      <input type="number" name="quantity" min={-10000} max={10000} step={1} required />
                    </Field>
                    <Field name="reference" label="Reference" required hint="Count sheet, return slip…">
                      <input type="text" name="reference" maxLength={120} required />
                    </Field>
                    <Field name="reason" label="Reason" required wide>
                      <textarea name="reason" rows={2} maxLength={500} required />
                    </Field>
                  </div>
                </ActionForm>
              </Card>
              <Card title="Low-stock alert">
                <ActionForm action={thresholdAction} idempotencyKey={randomUUID()} submitLabel="Save threshold" variant="default">
                  <input type="hidden" name="sku" value={sku} />
                  <Field name="threshold" label="Alert when available is at or below">
                    <input type="number" name="threshold" min={0} max={1000} defaultValue={record.lowStockThreshold} />
                  </Field>
                </ActionForm>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
