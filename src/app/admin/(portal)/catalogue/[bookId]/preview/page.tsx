import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout, Card, Money, PageHeader, PermissionDenied, PublishBadge } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { getBookForEdit, listCategories, storefrontContractFor } from "@/lib/admin/ops/catalogue";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Preview" };

export default async function PreviewBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const access = await pageAccess("catalogue.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { bookId } = await params;
  const store = getAdminStore();
  const row = await getBookForEdit(store, access.ctx, bookId);
  if (!row) notFound();
  const { book, variants, blockers } = row;
  const [contract, categories] = await Promise.all([storefrontContractFor(store, access.ctx, bookId), listCategories(store)]);
  const categoryNames = book.categoryIds.map((id) => categories.find((category) => category.id === id)?.name ?? id);
  const sellable = variants.filter((variant) => variant.active);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/catalogue", label: "Catalogue" }, { href: `/admin/catalogue/${book.id}`, label: book.title }]}
        eyebrow="Draft preview"
        title="How shoppers will see it"
        lede={<>Status: <PublishBadge status={book.status} />. This preview is private to staff; drafts are never served to the storefront.</>}
        actions={<Link className="adm-btn" href={`/admin/catalogue/${book.id}`}>Back to editing</Link>}
      />
      {blockers.length ? (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn" title="Not publishable yet">
            <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
          </Callout>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}><Callout tone="ok">All publishing requirements are met.</Callout></div>
      )}

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 260px) minmax(0, 1fr)", gap: 28, alignItems: "start" }} className="adm-preview">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover.url} alt={book.cover.alt} style={{ width: "100%", height: "auto", borderRadius: 8, boxShadow: "0 18px 40px rgba(32,37,59,.18)" }} />
          ) : (
            <div className="adm-cover" style={{ width: "100%" }}>Cover missing</div>
          )}
          <div>
            <p className="adm-eyebrow">{categoryNames.join(" · ").toUpperCase() || "UNCATEGORISED"}</p>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 6px" }}>{book.title}</h2>
            {book.subtitle ? <p style={{ margin: "0 0 6px", fontSize: 17 }}>{book.subtitle}</p> : null}
            <p className="adm-muted" style={{ marginTop: 0 }}>by {book.authors.join(", ") || "—"}</p>
            {sellable.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "14px 0" }}>
                {sellable.map((variant) => (
                  <div key={variant.sku} style={{ border: "1px solid var(--line-2)", borderRadius: 12, padding: "10px 14px", minWidth: 150 }}>
                    <strong>{variant.format}</strong>{variant.edition ? <span className="adm-small adm-muted"> · {variant.edition}</span> : null}
                    <div style={{ fontSize: 20, fontWeight: 750 }}><Money pesewas={variant.pricePesewas} /></div>
                    <span className="adm-small" style={{ color: variant.available > 0 ? "var(--green)" : "var(--red)", fontWeight: 650 }}>{variant.available > 0 ? "In stock" : "Out of stock — cannot be bought"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="adm-muted">No active variants — nothing to buy.</p>
            )}
            <p style={{ whiteSpace: "pre-line", maxWidth: "65ch" }}>{book.description || <span className="adm-muted">No description yet.</span>}</p>
            <dl className="adm-dl" style={{ marginTop: 14 }}>
              <dt>Language</dt><dd>{book.language}</dd>
              <dt>Age band</dt><dd>{book.ageBand}</dd>
              {book.publisher ? <><dt>Publisher</dt><dd>{book.publisher}</dd></> : null}
              {sellable.some((variant) => variant.isbn) ? <><dt>ISBN</dt><dd className="adm-mono">{sellable.flatMap((variant) => (variant.isbn ? [`${variant.isbn} (${variant.format})`] : [])).join(", ")}</dd></> : null}
              <dt>Delivery</dt><dd>Nationwide; exact price shown at checkout before payment.</dd>
            </dl>
          </div>
        </div>
      </Card>

      <Card title="Storefront data contract" description="The published shape shared commerce serves to /books/[slug] (see ADMIN_INTEGRATION_NOTES.md, R4). Cost prices are never included.">
        {contract ? (
          <pre className="adm-mono" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "var(--cream)", padding: 14, borderRadius: 10, margin: 0, maxHeight: 420, overflow: "auto" }}>{JSON.stringify(contract, null, 2)}</pre>
        ) : (
          <p className="adm-muted">Available once the book has a cover.</p>
        )}
      </Card>
    </>
  );
}
