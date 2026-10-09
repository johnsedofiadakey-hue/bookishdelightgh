import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ActionForm, Field } from "@/components/admin/action-form";
import { Badge, Callout, Card, EmptyState, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { listCategories } from "@/lib/admin/ops/catalogue";
import { RECOMMENDED_CATEGORIES, RETIRED_CATEGORY_SLUGS, STOREFRONT_CATEGORY_SLUGS } from "@/lib/admin/recommended-categories";
import { getAdminStore } from "@/lib/admin/store";
import type { Category } from "@/lib/admin/types";
import { addRecommendedCategoriesAction, hideRetiredCategoriesAction, saveCategoryAction } from "./actions";

export const metadata = { title: "Categories" };

function CategoryFields({ category, nextOrder }: { category?: Category; nextOrder: number }) {
  return (
    <div className="adm-fields adm-fields-3">
      <Field name="name" label="Name" required hint="Shown to customers, e.g. Chapter Books"><input type="text" name="name" defaultValue={category?.name} required maxLength={60} /></Field>
      <Field name="slug" label="Web address (slug)" hint={category ? "Changing this breaks existing links to the category." : "Leave empty to make it from the name."}>
        <input type="text" name="slug" defaultValue={category?.slug} placeholder="chapter-books" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
      </Field>
      <Field name="order" label="Display order" hint="Lower numbers show first"><input type="number" name="order" min={0} max={999} defaultValue={category?.order ?? nextOrder} /></Field>
      <Field name="caption" label="Short caption" wide hint="Optional line under the name, e.g. Bright pages for little ones"><input type="text" name="caption" defaultValue={category?.caption} maxLength={80} /></Field>
      <div className="adm-field" style={{ alignSelf: "end" }}>
        <label className="adm-check"><input type="checkbox" name="published" defaultChecked={category?.published ?? true} /> Visible on the website</label>
      </div>
    </div>
  );
}

export default async function CategoriesPage() {
  const access = await pageAccess("catalogue.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const store = getAdminStore();
  const [categories, books, variants] = await Promise.all([listCategories(store), store.query("books"), store.query("bookVariants")]);
  const editable = can(ctx, "content.edit");
  const counts = new Map<string, { total: number; published: number }>();
  for (const book of books) {
    for (const id of book.categoryIds) {
      const entry = counts.get(id) ?? { total: 0, published: 0 };
      entry.total += 1;
      if (book.status === "published") entry.published += 1;
      counts.set(id, entry);
    }
  }
  const bundleBookIds = new Set(variants.filter((variant) => variant.format === "Bundle").map((variant) => variant.bookId));
  const publishedBookIds = new Set(books.filter((book) => book.status === "published").map((book) => book.id));
  for (const category of categories.filter((item) => item.slug === "bundles")) {
    counts.set(category.id, { total: bundleBookIds.size, published: [...bundleBookIds].filter((id) => publishedBookIds.has(id)).length });
  }
  const existingSlugs = new Set(categories.map((category) => category.slug));
  const missingRecommended = RECOMMENDED_CATEGORIES.filter((category) => !existingSlugs.has(category.slug));
  const retiredVisible = categories.filter((category) => category.published && RETIRED_CATEGORY_SLUGS.has(category.slug));
  const nextOrder = categories.reduce((max, category) => Math.max(max, category.order), 0) + 1;

  return (
    <>
      <PageHeader eyebrow="Shelf" title="Categories" lede="These seven book types appear under both Brand New and Preloved. Choose them on a book; choose the shop section on each stock option. Bundle Deals appears automatically for Bundle stock options." />

      {editable && retiredVisible.length ? (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn" title="Old shelves are still showing on the website">
            <p style={{ margin: "4px 0 10px" }}>{retiredVisible.map((category) => category.name).join(", ")} came from the earlier site design and aren’t part of your range. Hiding keeps any products in them; you can move those products to the new shelves afterwards.</p>
            <ActionForm action={hideRetiredCategoriesAction} idempotencyKey={randomUUID()} submitLabel="Hide the old shelves" size="sm" variant="default" />
          </Callout>
        </div>
      ) : null}

      {editable && missingRecommended.length ? (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="info" title={`${missingRecommended.length} of the ${RECOMMENDED_CATEGORIES.length} recommended shelves ${missingRecommended.length === 1 ? "is" : "are"} not set up yet`}>
            <p style={{ margin: "4px 0 10px" }}>Missing: {missingRecommended.map((category) => category.name).join(", ")}. Add them in one step; you can rename, reorder or hide any of them afterwards. The homepage tiles and shop filters show whatever is visible here.</p>
            <ActionForm action={addRecommendedCategoriesAction} idempotencyKey={randomUUID()} submitLabel="Add the recommended shelves" size="sm" />
          </Callout>
        </div>
      ) : null}

      <Card title="All categories" description={categories.length ? `${categories.length} categor${categories.length === 1 ? "y" : "ies"}` : undefined}>
        {categories.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table" data-stack>
              <thead><tr><th>Order</th><th>Name</th><th>Web address</th><th>Products</th><th>Website</th></tr></thead>
              <tbody>
                {categories.map((category) => {
                  const count = counts.get(category.id) ?? { total: 0, published: 0 };
                  return (
                    <tr key={category.id}>
                      <td data-label="Order">{category.order}</td>
                      <td className="primary" data-label="Name"><strong>{category.name}</strong>{category.caption ? <span className="sub">{category.caption}</span> : null}</td>
                      <td data-label="Web address"><span className="adm-mono">/shop?category={category.slug}</span>{STOREFRONT_CATEGORY_SLUGS.has(category.slug) ? <span className="sub">Recommended shelf</span> : RETIRED_CATEGORY_SLUGS.has(category.slug) ? <span className="sub">Old shelf, not in your range</span> : null}</td>
                      <td data-label="Products"><Link className="adm-link" href={`/admin/catalogue?category=${encodeURIComponent(category.id)}`}>{count.total} product{count.total === 1 ? "" : "s"}</Link><span className="sub">{count.published} live</span></td>
                      <td data-label="Website">{category.published ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No categories yet" art="▦">Add the recommended categories above, or create your own below.</EmptyState>
        )}
      </Card>

      {editable ? (
        <>
          <Card title="Add a category">
            <ActionForm action={saveCategoryAction} idempotencyKey={randomUUID()} submitLabel="Add category" resetOnSuccess>
              <input type="hidden" name="categoryId" value="" />
              <CategoryFields nextOrder={nextOrder} />
            </ActionForm>
          </Card>
          {categories.length ? (
            <Card title="Edit categories" description="Open a category to rename it, change its order or hide it. Hiding keeps its products but removes the category from the website.">
              {categories.map((category) => (
                <details key={category.id} style={{ marginBottom: 10 }}>
                  <summary className="adm-link" style={{ cursor: "pointer" }}>{category.name}</summary>
                  <div style={{ paddingTop: 12 }}>
                    <ActionForm action={saveCategoryAction} idempotencyKey={randomUUID()} submitLabel="Save category">
                      <input type="hidden" name="categoryId" value={category.id} />
                      <CategoryFields category={category} nextOrder={nextOrder} />
                    </ActionForm>
                  </div>
                </details>
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <Callout tone="info">Your role can view categories but not change them. Ask an owner or manager.</Callout>
      )}
    </>
  );
}
