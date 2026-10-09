import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { EmptyState, Money, PageHeader, PermissionDenied, Stat, StockBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDate } from "@/lib/admin/format";
import { listInventory } from "@/lib/admin/ops/inventory";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Inventory" };

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
        eyebrow="Shelf"
        title="Inventory"
        lede="Stock is per SKU. Available = on hand − reserved for unpaid or unshipped orders. Every change is a ledger entry."
        actions={
          <>
            <a className="adm-btn" href="/admin/api/export/low-stock">{icons.download} Low-stock CSV</a>
            <a className="adm-btn" href="/admin/api/export/inventory">{icons.download} Full CSV</a>
          </>
        }
      />
      <div className="adm-stats">
        <Stat label="Active SKUs" value={active.length} href="/admin/inventory" />
        <Stat label="Units on hand" value={active.reduce((sum, row) => sum + row.onHand, 0)} note={`${active.reduce((sum, row) => sum + row.reserved, 0)} reserved`} />
        <Stat label="Low stock" value={active.filter((row) => row.state === "low").length} href="/admin/inventory?state=low" tone="alert" />
        <Stat label="Out of stock" value={active.filter((row) => row.state === "out").length} href="/admin/inventory?state=out" tone="alert" />
        {valuation !== null ? <Stat label="Stock at cost" value={<Money pesewas={valuation} />} note="Finance roles only; SKUs with a cost" /> : null}
      </div>

      <form className="adm-filters" role="search" action="/admin/inventory">
        <label className="adm-field grow">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q} placeholder="SKU, title or ISBN" />
        </label>
        <label className="adm-field">
          <span>Stock state</span>
          <select name="state" defaultValue={state}>
            <option value="all">All</option>
            <option value="in_stock">In stock</option>
            <option value="low">Low</option>
            <option value="out">Out</option>
            <option value="inactive">Inactive SKUs</option>
          </select>
        </label>
        <button className="adm-btn" type="submit">Apply</button>
      </form>

      {!all.length ? (
        <EmptyState title="No SKUs yet" art="📦" action={can(ctx, "catalogue.edit") ? <Link className="adm-btn" data-variant="primary" href="/admin/catalogue/new">Add a book</Link> : undefined}>
          Inventory records are created automatically (at zero) when you add a variant to a book. Then receive opening stock here.
        </EmptyState>
      ) : !rows.length ? (
        <EmptyState title="Nothing matches" art="⌕" action={<Link className="adm-btn" href="/admin/inventory">Clear filters</Link>} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table" data-stack>
            <thead>
              <tr>
                <th>SKU / title</th>
                <th className="num">On hand</th>
                <th className="num">Reserved</th>
                <th className="num">Available</th>
                <th>State</th>
                <th className="num">Threshold</th>
                {showCost ? <th className="num">Cost</th> : null}
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sku}>
                  <td className="primary" data-label="SKU">
                    <Link className="row-link adm-mono" href={`/admin/inventory/${encodeURIComponent(row.sku)}`}>{row.sku}</Link>
                    <span className="sub">{row.title} · {row.format}{row.active ? "" : " · inactive"}</span>
                  </td>
                  <td className="num" data-label="On hand">{row.onHand}</td>
                  <td className="num" data-label="Reserved">{row.reserved}</td>
                  <td className="num" data-label="Available"><strong>{row.available}</strong></td>
                  <td data-label="State"><StockBadge available={row.available} threshold={row.lowStockThreshold} /></td>
                  <td className="num" data-label="Threshold">{row.lowStockThreshold}</td>
                  {showCost ? <td className="num" data-label="Cost">{row.costPesewas !== undefined ? <Money pesewas={row.costPesewas} /> : "—"}</td> : null}
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
