import Link from "next/link";
import type { ReactNode } from "react";
import { formatLegalDate, legalFacts, legalPages } from "@/lib/legal";

/** Visible marker for a fact the owner has not confirmed yet. */
export function ToConfirm({ children }: { children: ReactNode }) {
  return <mark className="legal-todo">[To confirm: {children}]</mark>;
}

/** Renders a confirmed value, or a "To confirm" marker when it is still null. */
export function Fact({ value, missing }: { value: string | number | null; missing: string }) {
  return value === null || value === "" ? <ToConfirm>{missing}</ToConfirm> : <>{value}</>;
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="legal-section" id={id} aria-labelledby={`${id}-heading`}><h2 id={`${id}-heading`}>{title}</h2>{children}</section>;
}

export function LegalPage({ current, title, intro, children }: { current: string; title: string; intro: ReactNode; children: ReactNode }) {
  return <main className="interior-page shell legal-page" id="top">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span>{title}</nav>
    <div className="legal-layout">
      <aside className="legal-nav" aria-label="Policies">
        <p className="eyebrow">Policies</p>
        <ul>{legalPages.map((page) => <li key={page.href}><Link href={page.href} aria-current={page.href === current ? "page" : undefined}>{page.title}</Link></li>)}</ul>
        <Link className="legal-nav-track" href="/track">Track an order ↗</Link>
      </aside>
      <article className="legal-body">
        <p className="eyebrow">Bookish Delight GH</p>
        <h1>{title}</h1>
        <p className="legal-updated">Effective {formatLegalDate(legalFacts.effectiveDate)}</p>
        <div className="legal-intro">{intro}</div>
        {children}
        <p className="legal-footnote">Questions about this policy? Message us on WhatsApp at {legalFacts.whatsappDisplay} or write to {legalFacts.postalAddress}.</p>
      </article>
    </div>
  </main>;
}
