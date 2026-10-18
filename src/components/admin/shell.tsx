"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { icons, type IconName } from "@/components/admin/icons";
import { PageGuide } from "@/components/admin/page-guide";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <span className="adm-brand-type">
      bookish<i>delight</i>
      <small>ADMIN · GHANA</small>
    </span>
  );
}

export function AdminShell({ groups, user, devBanner, signOut, children }: { groups: NavGroup[]; user: { name: string; roleLabel: string }; devBanner?: ReactNode; signOut: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="adm-shell" data-nav-open={open}>
      <a className="skip-link" href="#adm-main">Skip to content</a>
      <aside className="adm-sidebar" id="adm-sidebar" aria-label="Admin navigation">
        <Link className="adm-brand" href="/admin">
          <span className="adm-brand-mark" aria-hidden="true" />
          <Brand />
        </Link>
        <nav className="adm-nav">
          {groups.map((group) => (
            <div className="adm-nav-group" key={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                      {icons[item.icon]}
                      {item.label}
                      {item.count ? (
                        <span className="adm-count" aria-label={`${item.count} need attention`}>
                          {item.count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="adm-sidebar-foot">
          <div className="adm-user">
            <span className="adm-avatar" aria-hidden="true">{initials}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.roleLabel}</span>
            </div>
          </div>
          {signOut}
        </div>
      </aside>
      {open ? <button className="adm-scrim" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <div className="adm-main">
        <div className="adm-topbar">
          <button className="adm-menu-button" type="button" aria-expanded={open} aria-controls="adm-sidebar" onClick={() => setOpen((value) => !value)}>
            {icons.menu}
            Menu
          </button>
          <Link className="adm-brand" href="/admin" style={{ padding: 0 }}>
            <Brand />
          </Link>
        </div>
        {devBanner}
        <main id="adm-main" className="adm-content" tabIndex={-1}>
          <PageGuide />
          {children}
        </main>
      </div>
    </div>
  );
}
