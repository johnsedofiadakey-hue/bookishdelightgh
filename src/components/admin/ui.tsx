import Link from "next/link";
import type { ReactNode } from "react";
import { FULFILMENT_LABELS, PAYMENT_LABELS, formatGhs } from "@/lib/admin/format";
import type { Permission } from "@/lib/admin/permissions";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import type { FulfilmentStatus, PaymentStatus, PublishStatus, StaffRole } from "@/lib/admin/types";

/* Server-safe presentational primitives for the admin. */

export function PageHeader({ eyebrow, title, lede, actions, crumbs }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; actions?: ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <header className="adm-page-head">
      <div>
        {crumbs?.length ? (
          <nav className="adm-crumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={crumb.href}>
                <Link href={crumb.href}>{crumb.label}</Link>
                {index < crumbs.length - 1 ? " /" : ""}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="adm-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className="adm-lede">{lede}</p> : null}
      </div>
      {actions ? <div className="adm-head-actions">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, description, actions, children, id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="adm-card" id={id} aria-labelledby={id && title ? `${id}-title` : undefined}>
      {title || actions ? (
        <div className="adm-card-head">
          <div>
            {title ? <h2 id={id ? `${id}-title` : undefined}>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, href, tone }: { label: string; value: ReactNode; note?: string; href?: string; tone?: "alert" | "calm" }) {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </>
  );
  return href ? (
    <Link className="adm-stat" href={href} data-tone={tone}>
      {body}
    </Link>
  ) : (
    <div className="adm-stat" data-tone={tone}>
      {body}
    </div>
  );
}

type Tone = "green" | "amber" | "red" | "blue" | "lavender" | "coral" | "plain";

export function Badge({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="adm-badge" data-tone={tone}>
      {children}
    </span>
  );
}

const paymentTone: Record<PaymentStatus, Tone> = { pending: "amber", paid: "green", failed: "red", abandoned: "plain", refund_pending: "lavender", partially_refunded: "lavender", refunded: "lavender" };
const fulfilmentTone: Record<FulfilmentStatus, Tone> = { new: "coral", picking: "blue", packed: "blue", dispatched: "lavender", delivered: "green", cancelled: "plain", returned: "amber", exception: "red" };

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentTone[status]}>{PAYMENT_LABELS[status]}</Badge>;
}

export function FulfilmentBadge({ status }: { status: FulfilmentStatus }) {
  return <Badge tone={fulfilmentTone[status]}>{FULFILMENT_LABELS[status]}</Badge>;
}

export function PublishBadge({ status }: { status: PublishStatus }) {
  return <Badge tone={status === "published" ? "green" : status === "draft" ? "amber" : "plain"}>{status === "published" ? "Published" : status === "draft" ? "Draft" : "Archived"}</Badge>;
}

export function StockBadge({ available, threshold }: { available: number; threshold: number }) {
  if (available <= 0) return <Badge tone="red">Out of stock</Badge>;
  if (available <= threshold) return <Badge tone="amber">Low · {available}</Badge>;
  return <Badge tone="green">{available} available</Badge>;
}

export function RoleBadge({ role }: { role: StaffRole }) {
  return <Badge tone={role === "owner" ? "coral" : role === "manager" ? "lavender" : "plain"}>{ROLE_LABELS[role]}</Badge>;
}

export function Money({ pesewas }: { pesewas: number }) {
  return <span className="adm-money">{formatGhs(pesewas)}</span>;
}

export function EmptyState({ title, children, action, art = "✦" }: { title: string; children?: ReactNode; action?: ReactNode; art?: string }) {
  return (
    <div className="adm-empty">
      <div className="adm-empty-art" aria-hidden="true">{art}</div>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger" | "ok"; title?: string; children: ReactNode }) {
  return (
    <div className="adm-callout" data-tone={tone} role={tone === "danger" ? "alert" : undefined}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  );
}

export function PermissionDenied({ permission }: { permission: Permission }) {
  return (
    <div className="adm-content">
      <EmptyState title="This area isn’t part of your role" art="⊘" action={<Link className="adm-btn" href="/admin">Back to dashboard</Link>}>
        Ask an owner if you need access. (Required permission: <code className="adm-mono">{permission}</code>.)
      </EmptyState>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <span className="adm-field-error">{message}</span> : null;
}
