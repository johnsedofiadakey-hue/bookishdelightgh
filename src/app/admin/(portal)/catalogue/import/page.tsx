import { randomUUID } from "node:crypto";
import { icons } from "@/components/admin/icons";
import { Callout, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "@/lib/admin/ops/catalogue-import";
import { importCommitAction, importDryRunAction } from "../actions";
import { ImportFlow } from "./import-client";

export const metadata = { title: "Import catalogue" };

export default async function ImportPage() {
  const access = await pageAccess("catalogue.import");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/catalogue", label: "Catalogue" }]}
        eyebrow="Bulk"
        title="Import from CSV"
        lede="Dry run first, then confirm. Imports only create new drafts — existing SKUs are never overwritten and nothing is published automatically."
        actions={<a className="adm-btn" href="/admin/api/export/import-template">{icons.download} Download template</a>}
      />
      <div style={{ marginBottom: 16 }}>
        <Callout tone="info" title="Columns">
          <span className="adm-mono adm-small">{IMPORT_COLUMNS.join(", ")}</span>
          <ul>
            <li>Required: title, sku, format, price_ghs, weight_grams. Rows sharing a <span className="adm-mono">book_slug</span> become variants of one book.</li>
            <li>Lists (authors, categories, tags) use commas or semicolons. Categories are shelf web addresses, e.g. <span className="adm-mono">chapter-books; christian</span>.</li>
            <li><span className="adm-mono">condition</span> is <span className="adm-mono">new</span> (default) or <span className="adm-mono">preloved</span>. Preloved rows need <span className="adm-mono">grade</span>: <span className="adm-mono">like_new</span>, <span className="adm-mono">very_good</span> or <span className="adm-mono">good</span>. Sell one title both ways by using the same <span className="adm-mono">book_slug</span> on two rows.</li>
            <li><span className="adm-mono">opening_quantity</span> needs <span className="adm-mono">opening_reference</span> (e.g. supplier invoice) and the inventory-receive permission.</li>
            <li>Up to {MAX_IMPORT_ROWS} rows per file. Never import sample or test products into production.</li>
          </ul>
        </Callout>
      </div>
      <ImportFlow dryRun={importDryRunAction} commit={importCommitAction} commitKey={randomUUID()} />
    </>
  );
}
