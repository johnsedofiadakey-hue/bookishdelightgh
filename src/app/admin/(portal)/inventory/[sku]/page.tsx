import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/action-form";
import { Badge, Callout, Card, EmptyState, PageHeader, PermissionDenied, Stat, StockBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDateTime } from "@/lib/admin/format";
import { linkedItems, maxAssemblable } from "@/lib/admin/ops/bundles";
import { ADJUSTMENT_LABELS, ADJUSTMENT_TYPES, availableOf, inventoryDetail, movementsForSku } from "@/lib/admin/ops/inventory";
import { getAdminStore } from "@/lib/admin/store";
import { optionLabel } from "@/lib/contracts/catalog";
import type { MovementType } from "@/lib/admin/types";
import { adjustStockAction, assembleBundlesAction, receiveStockAction, thresholdAction, unpackBundlesAction } from "../actions";

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
  BUNDLE_ASSEMBLED: "Bundle made up",
  BUNDLE_UNPACKED: "Bundle unpacked",
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
  const isBundle = variant.format === "Bundle";
  const linked = isBundle ? linkedItems(variant) : [];
  const componentInventory = new Map((await Promise.all(linked.map((item) => store.get("inventory", item.sku)))).flatMap((item) => (item ? [[item.sku, item] as const] : [])));
  const makeable = maxAssemblable(variant, componentInventory);
  // Bundles that contain this SKU, so staff know why single stock went down.
  const containingBundles = isBundle ? [] : (await store.query("bookVariants", { where: [["format", "==", "Bundle"]] })).filter((bundle) => linkedItems(bundle).some((item) => item.sku === sku));
  const available = availableOf(record);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/inventory", label: "Inventory" }, ...(book ? [{ href: `/admin/catalogue/${book.id}`, label: book.title }] : [])]}
        eyebrow={`${optionLabel(variant.format, variant.condition, variant.conditionGrade)}${variant.edition ? ` · ${variant.edition}` : ""}${variant.isbn ? ` · ISBN ${variant.isbn}` : ""}`}
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
          {isBundle ? (
            <Card title="What’s inside" description={linked.length ? `Single stock allows ${makeable} more bundle(s) right now.` : "No item is linked to a stocked SKU, so receive this bundle’s stock directly."}>
              <ul className="adm-timeline" style={{ marginBottom: 12 }}>
                {(variant.bundleItems ?? []).map((item, index) => {
                  const record = item.sku ? componentInventory.get(item.sku) : undefined;
                  return (
                    <li key={`${item.sku ?? item.title}-${index}`}>
                      <strong>{item.quantity} × {item.title}</strong>
                      <span>{item.sku ? <><Link className="adm-link adm-mono" href={`/admin/inventory/${encodeURIComponent(item.sku)}`}>{item.sku}</Link> · {record ? `${availableOf(record)} available singly` : "no stock record"}</> : "Not listed separately (not stock-tracked)"}</span>
                    </li>
                  );
                })}
              </ul>
              {linked.length && can(ctx, "inventory.adjust") ? (
                <div className="adm-stack">
                  {makeable > 0 ? (
                  <ActionForm action={assembleBundlesAction} idempotencyKey={randomUUID()} submitLabel="Make up bundles" variant="coral" resetOnSuccess>
                    <input type="hidden" name="sku" value={sku} />
                    <p className="adm-small adm-muted" style={{ margin: 0 }}>Takes the linked books out of single stock and adds them to this bundle’s stock, in one step.</p>
                    <div className="adm-fields">
                      <Field name="quantity" label="How many bundles" required hint={`Up to ${makeable}`}><input type="number" name="quantity" min={1} max={Math.max(1, makeable)} step={1} required /></Field>
                      <Field name="reference" label="Reference" required hint="e.g. Back-to-school batch, 9 Oct"><input type="text" name="reference" maxLength={120} required /></Field>
                    </div>
                  </ActionForm>
                  ) : (
                    <p className="adm-small adm-muted" style={{ margin: 0 }}>Not enough single stock to make up another bundle. Receive more of the linked books first.</p>
                  )}
                  {record.onHand > 0 ? (
                    <details>
                      <summary className="adm-link" style={{ cursor: "pointer" }}>Unpack bundles back into single stock</summary>
                      <div style={{ paddingTop: 10 }}>
                        <ActionForm action={unpackBundlesAction} idempotencyKey={randomUUID()} submitLabel="Unpack bundles" variant="danger" confirm="Unpack these bundles? The books go back into single stock and the bundle stock goes down." resetOnSuccess>
                          <input type="hidden" name="sku" value={sku} />
                          <div className="adm-fields">
                            <Field name="quantity" label="How many" required hint={`Up to ${Math.max(0, available)}`}><input type="number" name="quantity" min={1} max={Math.max(1, available)} step={1} required /></Field>
                            <Field name="reference" label="Reason / reference" required><input type="text" name="reference" maxLength={120} required /></Field>
                          </div>
                        </ActionForm>
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}
          {containingBundles.length ? (
            <Callout tone="info" title="This item is used in bundles">
              {containingBundles.map((bundle, index) => <span key={bundle.sku}>{index ? ", " : ""}<Link className="adm-link adm-mono" href={`/admin/inventory/${encodeURIComponent(bundle.sku)}`}>{bundle.sku}</Link></span>)}. Making up a bundle takes copies from here.
            </Callout>
          ) : null}
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
