import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/action-form";
import { BookForm } from "@/components/admin/book-form";
import { VariantOptionFields, type SkuOption } from "@/components/admin/variant-option-fields";
import { icons } from "@/components/admin/icons";
import { ImageUpload } from "@/components/admin/image-upload";
import { Badge, Callout, Card, Money, PageHeader, PermissionDenied, PublishBadge, StockBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDateTime, pesewasToDecimal } from "@/lib/admin/format";
import { getBookForEdit, listCategories } from "@/lib/admin/ops/catalogue";
import { getAdminStore } from "@/lib/admin/store";
import { BOOK_FORMATS, type BookVariant } from "@/lib/admin/types";
import { conditionLabel, optionLabel } from "@/lib/contracts/catalog";
import { createVariantAction, removeGalleryImageAction, saveBookAction, setBookStatusAction, updateCoverAltAction, updateVariantAction } from "../actions";

export const metadata = { title: "Edit book" };

function VariantFields({ variant, showCost, skuOptions }: { variant?: BookVariant; showCost: boolean; skuOptions: SkuOption[] }) {
  return (
    <div className="adm-fields adm-fields-4">
      {!variant ? (
        <Field name="sku" label="SKU" required hint="Unique. A–Z, 0–9, hyphens.">
          <input type="text" name="sku" required placeholder="MANGO-PB-NEW" style={{ textTransform: "uppercase" }} />
        </Field>
      ) : null}
      <VariantOptionFields
        formats={BOOK_FORMATS}
        format={variant?.format}
        condition={variant?.condition}
        grade={variant?.conditionGrade}
        note={variant?.conditionNote}
        compareAtPesewas={variant?.compareAtPesewas}
        bundleItems={variant?.bundleItems}
        skuOptions={skuOptions}
      />
      <Field name="edition" label="Edition">
        <input type="text" name="edition" defaultValue={variant?.edition} placeholder="e.g. 2nd edition, 2024 reprint" />
      </Field>
      <Field name="isbn" label="ISBN" hint="Optional; check digit is validated.">
        <input type="text" name="isbn" defaultValue={variant?.isbn} inputMode="numeric" placeholder="978…" />
      </Field>
      <Field name="price" label="Price (GH₵)" required>
        <input type="text" name="price" inputMode="decimal" defaultValue={variant ? pesewasToDecimal(variant.pricePesewas) : ""} placeholder="95.00" required />
      </Field>
      <Field name="weightGrams" label="Shipping weight (g)" required hint="Used for delivery quotes.">
        <input type="number" name="weightGrams" min={0} max={30000} step={1} defaultValue={variant?.weightGrams} required />
      </Field>
      {showCost ? (
        <Field name="cost" label="Cost (GH₵)" hint="Finance roles only.">
          <input type="text" name="cost" inputMode="decimal" defaultValue={variant?.costPesewas !== undefined ? pesewasToDecimal(variant.costPesewas) : ""} />
        </Field>
      ) : null}
      <div className="adm-field" style={{ alignSelf: "end" }}>
        <label className="adm-check">
          <input type="checkbox" name="active" defaultChecked={variant?.active ?? true} /> Active (sellable)
        </label>
        <label className="adm-check">
          <input type="checkbox" name="confirmDuplicateIsbn" /> <span className="adm-small">Separate listing for an existing ISBN</span>
        </label>
      </div>
    </div>
  );
}

export default async function EditBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const access = await pageAccess("catalogue.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const { bookId } = await params;
  const store = getAdminStore();
  const row = await getBookForEdit(store, ctx, bookId);
  if (!row) notFound();
  const { book, variants, blockers } = row;
  const [categories, books, allVariants] = await Promise.all([listCategories(store), store.query("books"), store.query("bookVariants")]);
  const titleById = new Map(books.map((other) => [other.id, other.title]));
  // Items a bundle can contain: any single (non-bundle) SKU in the catalogue.
  const skuOptions: SkuOption[] = allVariants
    .filter((other) => other.format !== "Bundle" && other.bookId !== book.id)
    .map((other) => ({ sku: other.sku, label: `${titleById.get(other.bookId) ?? other.bookId} · ${optionLabel(other.format, other.condition, other.conditionGrade)}` }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const editable = can(ctx, "catalogue.edit") && book.status !== "archived";
  const canPublish = can(ctx, "catalogue.publish");
  const showCost = can(ctx, "finance.view");
  const hasVariant = variants.length > 0;
  const hasStock = variants.some((variant) => variant.onHand > 0);
  const step = (done: boolean, current: boolean) => (done ? "done" : current ? "current" : undefined);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/catalogue", label: "Catalogue" }]}
        eyebrow={book.authors.join(", ")}
        title={book.title}
        lede={<><PublishBadge status={book.status} /> <span className="adm-small adm-muted">Last updated {formatDateTime(book.updatedAt)}</span></>}
        actions={
          <>
            <Link className="adm-btn" href={`/admin/catalogue/${book.id}/preview`}>{icons.eye} Preview</Link>
            {canPublish && book.status === "draft" ? (
              <ActionForm action={setBookStatusAction} idempotencyKey={randomUUID()} submitLabel="Publish" variant="coral" inline>
                <input type="hidden" name="bookId" value={book.id} />
                <input type="hidden" name="status" value="published" />
              </ActionForm>
            ) : null}
            {canPublish && book.status === "published" ? (
              <ActionForm action={setBookStatusAction} idempotencyKey={randomUUID()} submitLabel="Unpublish" variant="default" inline confirm="Unpublish this book? It disappears from the storefront immediately.">
                <input type="hidden" name="bookId" value={book.id} />
                <input type="hidden" name="status" value="draft" />
              </ActionForm>
            ) : null}
            {canPublish && book.status !== "archived" ? (
              <ActionForm action={setBookStatusAction} idempotencyKey={randomUUID()} submitLabel="Archive" variant="danger" inline confirm="Archive this book? It will be hidden and cannot be sold. Order history is kept.">
                <input type="hidden" name="bookId" value={book.id} />
                <input type="hidden" name="status" value="archived" />
              </ActionForm>
            ) : null}
            {canPublish && book.status === "archived" ? (
              <ActionForm action={setBookStatusAction} idempotencyKey={randomUUID()} submitLabel="Restore to draft" inline>
                <input type="hidden" name="bookId" value={book.id} />
                <input type="hidden" name="status" value="draft" />
              </ActionForm>
            ) : null}
          </>
        }
      />

      {book.status === "draft" ? (
        <ol className="adm-steps" aria-label="Publishing steps">
          <li data-state="done">1 · Details</li>
          <li data-state={step(hasVariant, !hasVariant)}>2 · Variant</li>
          <li data-state={step(hasStock, hasVariant && !hasStock)}>3 · Opening stock</li>
          <li data-state={step(Boolean(book.cover), hasVariant && hasStock && !book.cover)}>4 · Cover</li>
          <li data-state={step(false, blockers.length === 0)}>5 · Preview &amp; publish</li>
        </ol>
      ) : null}
      {book.status !== "published" && blockers.length ? (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn" title="Before this book can be published">
            <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
          </Callout>
        </div>
      ) : null}
      {book.status === "archived" ? <div style={{ marginBottom: 16 }}><Callout tone="info">This book is archived. Restore it to draft to make changes.</Callout></div> : null}

      <div className="adm-grid adm-grid-main">
        <div className="adm-stack">
          <Card title="Variants" description="Each format/edition is sold and stocked separately." id="variants">
            {variants.length ? (
              <div className="adm-table-wrap" style={{ marginBottom: 14 }}>
                <table className="adm-table" data-stack>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Format</th>
                      <th className="num">Price</th>
                      <th className="num">Weight</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant) => (
                      <tr key={variant.sku}>
                        <td className="primary" data-label="SKU">
                          <Link className="row-link adm-mono" href={`/admin/inventory/${encodeURIComponent(variant.sku)}`}>{variant.sku}</Link>
                          {variant.isbn ? <span className="sub adm-mono">ISBN {variant.isbn}</span> : null}
                          {!variant.active ? <span className="sub">Inactive</span> : null}
                        </td>
                        <td data-label="Format">{variant.format}{variant.edition ? <span className="sub">{variant.edition}</span> : null}<span className="sub"><Badge tone={variant.condition === "preloved" ? "green" : "blue"}>{conditionLabel(variant.condition, variant.conditionGrade)}</Badge></span></td>
                        <td className="num" data-label="Price"><Money pesewas={variant.pricePesewas} /></td>
                        <td className="num" data-label="Weight">{variant.weightGrams} g</td>
                        <td data-label="Stock"><StockBadge available={variant.available} threshold={0} /> <span className="sub">{variant.onHand} on hand</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="adm-muted" style={{ marginTop: 0 }}>No variants yet. Add the format you stock (e.g. Paperback) with its SKU, price and shipping weight.</p>
            )}
            {editable ? (
              <>
                {variants.map((variant) => (
                  <details key={variant.sku} style={{ marginBottom: 10 }}>
                    <summary className="adm-link" style={{ cursor: "pointer" }}>Edit {variant.sku}</summary>
                    <div style={{ paddingTop: 12 }}>
                      <ActionForm action={updateVariantAction} idempotencyKey={randomUUID()} submitLabel="Save variant">
                        <input type="hidden" name="sku" value={variant.sku} />
                        <VariantFields variant={variant} showCost={showCost} skuOptions={skuOptions} />
                      </ActionForm>
                    </div>
                  </details>
                ))}
                <details open={!variants.length}>
                  <summary className="adm-link" style={{ cursor: "pointer" }}>+ Add a variant</summary>
                  <div style={{ paddingTop: 12 }}>
                    <ActionForm action={createVariantAction} idempotencyKey={randomUUID()} submitLabel="Create variant at zero stock" resetOnSuccess>
                      <input type="hidden" name="bookId" value={book.id} />
                      <VariantFields showCost={showCost} skuOptions={skuOptions} />
                    </ActionForm>
                  </div>
                </details>
              </>
            ) : null}
            {variants.length && can(ctx, "inventory.receive") ? (
              <p className="adm-small adm-muted" style={{ marginBottom: 0 }}>Opening stock is received per SKU from <Link className="adm-link" href={`/admin/inventory/${encodeURIComponent(variants[0].sku)}`}>Inventory</Link> so it is recorded in the stock ledger.</p>
            ) : null}
          </Card>

          <Card title="Book details">
            <BookForm action={saveBookAction} idempotencyKey={randomUUID()} book={book} categories={categories} otherBooks={books.filter((other) => other.id !== book.id && other.status !== "archived").map((other) => ({ id: other.id, title: other.title, status: other.status }))} disabled={!editable} />
          </Card>
        </div>

        <div className="adm-stack">
          <Card title="Cover" description="Required before publishing.">
            {book.cover ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="adm-cover" src={book.cover.url} alt={book.cover.alt} width={96} height={144} />
                <div className="adm-small adm-muted" style={{ flex: "1 1 200px", minWidth: 0 }}>
                  {book.cover.width}×{book.cover.height}px · {Math.round(book.cover.bytes / 1024)} KB WebP
                  {editable ? (
                    <ActionForm action={updateCoverAltAction} idempotencyKey={randomUUID()} submitLabel="Save alt text" size="sm" variant="default">
                      <input type="hidden" name="bookId" value={book.id} />
                      <Field name="alt" label="Alt text">
                        <input type="text" name="alt" defaultValue={book.cover.alt} maxLength={250} />
                      </Field>
                    </ActionForm>
                  ) : (
                    <p>Alt: {book.cover.alt}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="adm-cover" style={{ width: 96, marginBottom: 14 }}>No cover yet</div>
            )}
            {editable ? <ImageUpload target="cover" ownerId={book.id} label={book.cover ? "Replace cover" : "Upload cover"} defaultAlt={book.cover ? "" : `Cover of ${book.title}`} replaceNote={book.cover ? "The previous file is deleted after the swap." : undefined} /> : null}
          </Card>

          <Card title="Gallery" description="Optional extra images (up to 8).">
            {book.gallery.length ? (
              <div className="adm-thumbs" style={{ marginBottom: 12 }}>
                {book.gallery.map((image) => (
                  <div key={image.path} style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="adm-cover" src={image.url} alt={image.alt} width={72} height={108} style={{ width: 72 }} />
                    {editable ? (
                      <ActionForm action={removeGalleryImageAction} idempotencyKey={randomUUID()} submitLabel="Remove" size="sm" variant="danger" confirm="Remove this image?">
                        <input type="hidden" name="bookId" value={book.id} />
                        <input type="hidden" name="path" value={image.path} />
                      </ActionForm>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {editable && book.gallery.length < 8 ? <ImageUpload target="gallery" ownerId={book.id} label="Add gallery image" /> : null}
          </Card>
        </div>
      </div>
    </>
  );
}
