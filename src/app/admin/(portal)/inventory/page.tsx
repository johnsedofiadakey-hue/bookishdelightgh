import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { EmptyState, Money, PageHeader, PermissionDenied, Stat, StockBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDate } from "@/lib/admin/format";
import { listInventory } from "@/lib/admin/ops/inventory";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Stock" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ state?: string; q?: string }> }) {
  const access = await pageAccess("inventory.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const { state = "all", q = "" } = await searchParams;
  const all = await listInventory(getAdminStore(), ctx);
  const active = all.filter((row) => row.active);
  const needle = q.trim().toLowerCase();
  const rows = all.filter((row) => (state === "all" || (state === "inactive" ? !row.active : row.active && row.state === state)) && (!needle || `${row.sku} ${row.title} ${row.isbn ?? ""}`.toLowerCase().includes(needle)));
  const showCost = can(ctx, "finance.view");
  const valuation = showCost ? active.reduce((sum, row) => sum + (row.costPesewas ?? 0) * Math.max(0, row.onHand), 0) : null;

  return (
    <>
      <PageHeader
        eyebrow="Shop"
        title="Stock"
        lede="Stock is counted for each item code. Available = on the shelf − held for orders that aren’t paid or sent yet. Every change is recorded."
        actions={
          <>
            <a className="adm-btn" href="/admin/api/export/low-stock">{icons.download} Low-stock CSV</a>
            <a className="adm-btn" href="/admin/api/export/inventory">{icons.download} Full CSV</a>
          </>
        }
      />
      <div className="adm-stats">
        <Stat label="Items for sale" value={active.length} href="/admin/inventory" />
        <Stat label="Copies on the shelf" value={active.reduce((sum, row) => sum + row.onHand, 0)} note={`${active.reduce((sum, row) => sum + row.reserved, 0)} reserved`} />
        <Stat label="Low stock" value={active.filter((row) => row.state === "low").length} href="/admin/inventory?state=low" tone="alert" />
        <Stat label="Out of stock" value={active.filter((row) => row.state === "out").length} href="/admin/inventory?state=out" tone="alert" />
        {valuation !== null ? <Stat label="Stock value (what you paid)" value={<Money pesewas={valuation} />} note="Owner and managers only. Items with a cost entered" /> : null}
      </div>

      <form className="adm-filters" role="search" action="/admin/inventory">
        <label className="adm-field grow">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q} placeholder="Item code, title or ISBN" />
        </label>
        <label className="adm-field">
          <span>Stock level</span>
          <select name="state" defaultValue={state}>
            <option value="all">All</option>
            <option value="in_stock">In stock</option>
            <option value="low">Low</option>
            <option value="out">Out</option>
            <option value="inactive">Not for sale</option>
          </select>
        </label>
        <button className="adm-btn" type="submit">Apply</button>
      </form>

      {!all.length ? (
        <EmptyState title="No items yet" icon="inventory" action={can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">Add a book</Link> : undefined}>
          When you add an option to a product, it shows up here with 0 stock. Then add your stock here.
        </EmptyState>
      ) : !rows.length ? (
        <EmptyState title="Nothing matches" icon="search" action={<Link className="adm-btn" href="/admin/inventory">Clear filters</Link>} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table" data-stack>
            <thead>
              <tr>
                <th>Item code / title</th>
                <th className="num">On shelf</th>
                <th className="num">Held for orders</th>
                <th className="num">Available</th>
                <th>Level</th>
                <th className="num">Low at</th>
                {showCost ? <th className="num">Paid</th> : null}
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sku}>
                  <td className="primary" data-label="Item code">
                    <Link className="row-link adm-mono" href={`/admin/inventory/${encodeURIComponent(row.sku)}`}>{row.sku}</Link>
                    <span className="sub">{row.title} · {row.format}{row.active ? "" : " · inactive"}</span>
                  </td>
                  <td className="num" data-label="On shelf">{row.onHand}</td>
                  <td className="num" data-label="Held for orders">{row.reserved}</td>
                  <td className="num" data-label="Available"><strong>{row.available}</strong></td>
                  <td data-label="Level"><StockBadge available={row.available} threshold={row.lowStockThreshold} /></td>
                  <td className="num" data-label="Low at">{row.lowStockThreshold}</td>
                  {showCost ? <td className="num" data-label="Paid">{row.costPesewas !== undefined ? <Money pesewas={row.costPesewas} /> : "—"}</td> : null}
                  <td className="nowrap" data-label="Updated">{formatDate(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
