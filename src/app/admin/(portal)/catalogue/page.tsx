import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { EmptyState, Money, PageHeader, PermissionDenied, PublishBadge, StockBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDate } from "@/lib/admin/format";
import { listCatalogue, listCategories, type CatalogueFilter } from "@/lib/admin/ops/catalogue";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Catalogue" };

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await pageAccess("catalogue.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const params = await searchParams;
  const filter: CatalogueFilter = {
    q: params.q,
    status: (params.status as CatalogueFilter["status"]) ?? "all",
    categoryId: params.category || undefined,
    stock: (params.stock as CatalogueFilter["stock"]) ?? "all",
    sort: (params.sort as CatalogueFilter["sort"]) ?? "updated",
  };
  const store = getAdminStore();
  const [rows, categories, all] = await Promise.all([listCatalogue(store, ctx, filter), listCategories(store), listCatalogue(store, ctx, {})]);
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const filtered = Boolean(params.q || (params.status && params.status !== "all") || params.category || (params.stock && params.stock !== "all"));

  return (
    <>
      <PageHeader
        eyebrow="Shelf"
        title="Catalogue"
        lede="Books are the editorial record; each format or edition is a variant with its own SKU, price and stock."
        actions={
          <>
            <a className="adm-btn" href="/admin/api/export/catalogue">{icons.download} Export CSV</a>
            {can(ctx, "catalogue.import") ? <Link className="adm-btn" href="/admin/catalogue/import">Import CSV</Link> : null}
            {can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">{icons.plus} Add a book</Link> : null}
          </>
        }
      />

      <form className="adm-filters" role="search" action="/admin/catalogue">
        <label className="adm-field grow">
          <span>Search</span>
          <input type="search" name="q" defaultValue={params.q} placeholder="Title, author, ISBN or SKU" />
        </label>
        <label className="adm-field">
          <span>Status</span>
          <select name="status" defaultValue={filter.status}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="adm-field">
          <span>Category</span>
          <select name="category" defaultValue={params.category ?? ""}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="adm-field">
          <span>Stock</span>
          <select name="stock" defaultValue={filter.stock}>
            <option value="all">Any stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </label>
        <label className="adm-field">
          <span>Sort</span>
          <select name="sort" defaultValue={filter.sort}>
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
            <option value="stock">Least stock first</option>
            <option value="price">Lowest price first</option>
          </select>
        </label>
        <button className="adm-btn" type="submit">Apply</button>
        {filtered ? <Link className="adm-btn" data-variant="ghost" href="/admin/catalogue">Clear</Link> : null}
      </form>

      {!all.length ? (
        <EmptyState title="Your shelf is empty" art="📚" action={can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">Add your first book</Link> : undefined}>
          Start with one book: add its details, create a variant (format, SKU, price, weight), receive its opening stock, upload a cover, then publish. Or import many at once from a CSV.
        </EmptyState>
      ) : !rows.length ? (
        <EmptyState title="No books match these filters" art="⌕" action={<Link className="adm-btn" href="/admin/catalogue">Clear filters</Link>} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table" data-stack>
            <caption className="sr-only">{rows.length} books</caption>
            <thead>
              <tr>
                <th>Book</th>
                <th>Status</th>
                <th>Variants</th>
                <th>Stock</th>
                <th className="num">From</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.book.id}>
                  <td className="primary" data-label="Book">
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      {row.book.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="adm-cover adm-cover-sm" src={row.book.cover.url} alt="" width={36} height={54} />
                      ) : (
                        <span className="adm-cover adm-cover-sm" aria-hidden="true" />
                      )}
                      <div>
                        <Link className="row-link" href={`/admin/catalogue/${row.book.id}`}>{row.book.title}</Link>
                        <span className="sub">{row.book.authors.join(", ")} · {row.book.categoryIds.map((id) => categoryName.get(id) ?? id).join(", ") || "No category"}</span>
                        {row.book.status === "draft" && row.blockers.length ? <span className="sub" style={{ color: "var(--amber)" }}>{row.blockers.length} step(s) before publishing</span> : null}
                      </div>
                    </div>
                  </td>
                  <td data-label="Status"><PublishBadge status={row.book.status} /></td>
                  <td data-label="Variants">
                    {row.variants.length ? row.variants.map((variant) => <span className="sub adm-mono" key={variant.sku}>{variant.sku} · {variant.format}{variant.active ? "" : " (inactive)"}</span>) : <span className="adm-muted">None yet</span>}
                  </td>
                  <td data-label="Stock"><StockBadge available={row.totalAvailable} threshold={0} /></td>
                  <td className="num" data-label="From">{row.minPricePesewas !== null ? <Money pesewas={row.minPricePesewas} /> : "—"}</td>
                  <td className="nowrap" data-label="Updated">{formatDate(row.book.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
