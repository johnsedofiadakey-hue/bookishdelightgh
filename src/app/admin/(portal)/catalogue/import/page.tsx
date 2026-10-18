import { randomUUID } from "node:crypto";
import { icons } from "@/components/admin/icons";
import { Callout, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "@/lib/admin/ops/catalogue-import";
import { importCommitAction, importDryRunAction } from "../actions";
import { ImportFlow } from "./import-client";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  const access = await pageAccess("catalogue.import");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/catalogue", label: "Products" }]}
        eyebrow="Add many at once"
        title="Import from a spreadsheet"
        lede="First check the file, then confirm. Importing only adds new drafts. It never changes items you already have, and it never publishes anything by itself."
        actions={<a className="adm-btn" href="/admin/api/export/import-template">{icons.download} Download template</a>}
      />
      <div style={{ marginBottom: 16 }}>
        <Callout tone="info" title="Columns">
          <span className="adm-mono adm-small">{IMPORT_COLUMNS.join(", ")}</span>
          <ul>
            <li>You must fill in: title, sku, format, price_ghs, weight_grams. Rows with the same <span className="adm-mono">book_slug</span> become options of one product.</li>
            <li>For lists (authors, categories, tags), separate with commas or semicolons. For categories, use the shelf’s web address, e.g. <span className="adm-mono">chapter-books; christian</span>.</li>
            <li><span className="adm-mono">condition</span> is <span className="adm-mono">new</span> (if empty) or <span className="adm-mono">preloved</span>. Preloved rows also need a <span className="adm-mono">grade</span>: <span className="adm-mono">like_new</span>, <span className="adm-mono">very_good</span> or <span className="adm-mono">good</span>. To sell a book both new and preloved, use the same <span className="adm-mono">book_slug</span> on two rows.</li>
            <li><span className="adm-mono">opening_quantity</span> needs <span className="adm-mono">opening_reference</span> (e.g. supplier invoice number), and your role must be allowed to add stock.</li>
            <li>Up to {MAX_IMPORT_ROWS} rows per file. Never import sample or test products into production.</li>
          </ul>
        </Callout>
      </div>
      <ImportFlow dryRun={importDryRunAction} commit={importCommitAction} commitKey={randomUUID()} />
    </>
  );
}
