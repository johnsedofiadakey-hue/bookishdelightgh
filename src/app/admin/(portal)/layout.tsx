import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell, type NavGroup, type NavItem } from "@/components/admin/shell";
import { currentSession } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { isAdminError } from "@/lib/admin/errors";
import { ROLE_LABELS, type Permission } from "@/lib/admin/permissions";
import { getAdminStore } from "@/lib/admin/store";
import { signOutAction } from "../session-actions";

export const dynamic = "force-dynamic";

type Entry = NavItem & { permission: Permission };

export default async function PortalLayout({ children }: { children: ReactNode }) {
  let session: Awaited<ReturnType<typeof currentSession>>;
  try {
    session = await currentSession();
  } catch (error) {
    // Store/identity not connected: send staff to sign-in, which explains why.
    if (isAdminError(error) && error.code === "unavailable") redirect("/admin/sign-in?reason=unavailable");
    throw error;
  }
  if (!session.ok) redirect(`/admin/sign-in?reason=${session.reason === "missing" ? "" : session.reason}`);
  const { ctx } = session;
  const store = getAdminStore();

  const [orders, notifications] = await Promise.all([
    can(ctx, "orders.view") ? store.query("orders", { where: [["paymentStatus", "==", "paid"]] }) : Promise.resolve([]),
    can(ctx, "notifications.view") ? store.query("notifications", { where: [["status", "==", "failed"]] }) : Promise.resolve([]),
  ]);
  const awaiting = orders.filter((order) => ["new", "picking", "packed"].includes(order.fulfilmentStatus)).length;

  const sections: { label: string; entries: Entry[] }[] = [
    {
      label: "Today",
      entries: [
        { href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard.view" },
        { href: "/admin/orders", label: "Orders", icon: "orders", permission: "orders.view", count: awaiting },
        { href: "/admin/orders/new", label: "Manual sale", icon: "manual", permission: "orders.manual_sale" },
      ],
    },
    {
      label: "Shelf",
      entries: [
        { href: "/admin/catalogue", label: "Catalogue", icon: "catalogue", permission: "catalogue.view" },
        { href: "/admin/categories", label: "Categories", icon: "categories", permission: "catalogue.view" },
        { href: "/admin/inventory", label: "Inventory", icon: "inventory", permission: "inventory.view" },
        { href: "/admin/content", label: "Homepage", icon: "content", permission: "content.view" },
        { href: "/admin/promotions", label: "Promotions", icon: "promotions", permission: "promotions.view" },
        { href: "/admin/delivery", label: "Delivery rates", icon: "delivery", permission: "delivery.view" },
      ],
    },
    {
      label: "People & records",
      entries: [
        { href: "/admin/customers", label: "Customers", icon: "customers", permission: "customers.view" },
        { href: "/admin/notifications", label: "SMS log", icon: "notifications", permission: "notifications.view", count: notifications.length },
        { href: "/admin/reports", label: "Reports", icon: "reports", permission: "reports.view" },
        { href: "/admin/audit", label: "Audit trail", icon: "audit", permission: "audit.view" },
      ],
    },
    {
      label: "Admin",
      entries: [
        { href: "/admin/staff", label: "Staff & roles", icon: "staff", permission: "staff.view" },
        { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings.view" },
      ],
    },
  ];

  const groups: NavGroup[] = sections
    .map((section) => ({
      label: section.label,
      items: section.entries.filter((entry) => can(ctx, entry.permission)).map(({ permission: _permission, ...item }) => item),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AdminShell
      groups={groups}
      user={{ name: ctx.name, roleLabel: ROLE_LABELS[ctx.role] }}
      devBanner={
        store.isDevelopmentData ? (
          <div className="adm-dev-banner" role="note">
            <b>DEVELOPMENT DATA</b> · In-memory fixtures. Nothing here is real stock, orders or payments, and it resets on restart.
          </div>
        ) : null
      }
      signOut={
        <form action={signOutAction}>
          <button className="adm-signout" type="submit">
            Sign out
          </button>
        </form>
      }
    >
      {children}
    </AdminShell>
  );
}
