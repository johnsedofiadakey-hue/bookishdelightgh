import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { Badge, Callout, EmptyState, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { formatDateTime } from "@/lib/admin/format";
import { listAudit } from "@/lib/admin/ops/reports";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import { getAdminStore } from "@/lib/admin/store";

export const metadata = { title: "Audit trail" };

const ENTITY_TYPES = ["order", "inventory", "book", "bookVariant", "deliveryRate", "promotion", "siteContent", "siteSettings", "adminProfile", "notification", "catalogue", "category", "export"];

function entityHref(type: string, id: string): string | null {
  if (type === "order") return `/admin/orders/${id}`;
  if (type === "inventory" || type === "bookVariant") return `/admin/inventory/${encodeURIComponent(id)}`;
  if (type === "book") return `/admin/catalogue/${id}`;
  return null;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; entity?: string }> }) {
  const access = await pageAccess("audit.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { q = "", entity = "" } = await searchParams;
  const events = await listAudit(getAdminStore(), access.ctx, { q, entityType: entity || undefined });

  return (
    <>
      <PageHeader eyebrow="Records" title="Audit trail" lede="Every privileged change: who, what, when and why. Append-only — entries cannot be edited or deleted from the admin." actions={<a className="adm-btn" href="/admin/api/export/audit">{icons.download} Export CSV</a>} />
      <div style={{ marginBottom: 14 }}>
        <Callout tone="info">Firestore rules must deny client writes to <span className="adm-mono">auditEvents</span>; only server code appends (see ADMIN_INTEGRATION_NOTES.md).</Callout>
      </div>
      <form className="adm-filters" role="search" action="/admin/audit">
        <label className="adm-field grow"><span>Search</span><input type="search" name="q" defaultValue={q} placeholder="Action, summary, entity ID, person, reason" /></label>
        <label className="adm-field">
          <span>Entity</span>
          <select name="entity" defaultValue={entity}>
            <option value="">All</option>
            {ENTITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <button className="adm-btn" type="submit">Filter</button>
      </form>
      {events.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table" data-stack>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Reason</th></tr></thead>
            <tbody>
              {events.map((event) => {
                const href = entityHref(event.entityType, event.entityId);
                return (
                  <tr key={event.id}>
                    <td className="nowrap" data-label="When">{formatDateTime(event.at)}</td>
                    <td data-label="Who">{event.actorName}<span className="sub">{event.actorRole === "system" ? "System" : ROLE_LABELS[event.actorRole]}</span></td>
                    <td className="primary" data-label="Action"><strong>{event.summary}</strong><span className="sub adm-mono">{event.action}</span></td>
                    <td data-label="Entity"><Badge>{event.entityType}</Badge>{href ? <Link className="sub adm-link adm-mono" href={href}>{event.entityId}</Link> : <span className="sub adm-mono">{event.entityId}</span>}</td>
                    <td data-label="Reason">{event.reason ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No audit events match" art="§" />
      )}
    </>
  );
}
