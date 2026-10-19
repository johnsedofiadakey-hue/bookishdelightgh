import Link from "next/link";
import { GuideContent } from "@/components/admin/guide-content";
import { Card, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { ADMIN_GUIDES, GETTING_STARTED } from "@/lib/admin/guides";

export const metadata = { title: "Help & guides" };

export default async function HelpPage() {
  const access = await pageAccess("dashboard.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const guides = ADMIN_GUIDES.filter((guide) => guide.id !== "help");

  return (
    <>
      <PageHeader eyebrow="Help" title="Help & guides" lede="How to use every page of the admin, in plain steps. Each page also has its own guide in the blue box at the top." />

      <Card title="Getting started" description="Do these once, in this order, before you take online orders.">
        <ol className="adm-help-steps">
          {GETTING_STARTED.map((step) => (
            <li key={step.title}>
              <div>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </div>
              <Link className="adm-btn" data-size="sm" href={step.href}>Open</Link>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Every page" description="Jump to a page’s guide.">
        <ul className="adm-help-toc">
          {guides.map((guide) => <li key={guide.id}><a href={`#guide-${guide.id}`}>{guide.title}</a></li>)}
        </ul>
        <div className="adm-stack">
          {guides.map((guide) => (
            <section className="adm-guide adm-help-guide" id={`guide-${guide.id}`} key={guide.id} aria-labelledby={`guide-${guide.id}-title`}>
              <div className="adm-guide-body" style={{ paddingTop: 14, paddingLeft: 16 }}>
                <h2 id={`guide-${guide.id}-title`} style={{ margin: "0 0 4px", fontSize: 17 }}>{guide.title}</h2>
                <p className="adm-guide-purpose">{guide.purpose}</p>
                <GuideContent guide={guide} />
                <Link className="adm-link" href={guide.href}>Go to {guide.title}</Link>
              </div>
            </section>
          ))}
        </div>
      </Card>
    </>
  );
}
