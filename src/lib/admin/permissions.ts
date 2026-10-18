import type { StaffRole } from "@/lib/admin/types";

/**
 * Granular permissions. Server operations check these; the UI only uses them
 * to decide what to show. Hiding a button is never the enforcement.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "catalogue.view",
  "catalogue.edit",
  "catalogue.publish",
  "catalogue.import",
  "inventory.view",
  "inventory.receive",
  "inventory.adjust",
  "orders.view",
  "orders.fulfil",
  "orders.cancel",
  "orders.manual_sale",
  "payments.approve_manual",
  "payments.refund",
  "delivery.view",
  "delivery.edit",
  "promotions.view",
  "promotions.edit",
  "content.view",
  "content.edit",
  "content.publish",
  "customers.view",
  "customers.view_contact",
  "notifications.view",
  "notifications.retry",
  "reports.view",
  "finance.view",
  "settings.view",
  "settings.edit",
  "staff.view",
  "staff.manage",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const viewer: Permission[] = [
  "dashboard.view",
  "catalogue.view",
  "inventory.view",
  "orders.view",
  "delivery.view",
  "promotions.view",
  "content.view",
  "notifications.view",
];

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  manager: new Set(PERMISSIONS.filter((permission) => permission !== "staff.manage")),
  catalogue_editor: new Set<Permission>([
    ...viewer,
    "catalogue.edit",
    "catalogue.publish",
    "catalogue.import",
    "inventory.receive",
    "content.edit",
  ]),
  fulfilment: new Set<Permission>([
    ...viewer,
    "orders.fulfil",
    "orders.manual_sale",
    "inventory.receive",
    "inventory.adjust",
    "customers.view",
    "customers.view_contact",
  ]),
  support: new Set<Permission>([
    ...viewer,
    "customers.view",
    "customers.view_contact",
    "notifications.retry",
  ]),
  viewer: new Set<Permission>(viewer),
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  catalogue_editor: "Product editor",
  fulfilment: "Packing & delivery",
  support: "Support",
  viewer: "View only",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: "Can do everything, including staff, roles and refunds.",
  manager: "Can run the shop and see the money. Can’t add or change staff.",
  catalogue_editor: "Can add and edit products, options and photos, import spreadsheets, add new stock and draft the homepage.",
  fulfilment: "Can pack and send orders, record sales made outside the website and fix stock counts.",
  support: "Can look up orders, contact customers and resend text messages.",
  viewer: "Can look but not change anything. Can’t see customer contact details.",
};

export function roleHas(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsFor(role: StaffRole): Permission[] {
  return PERMISSIONS.filter((permission) => ROLE_PERMISSIONS[role].has(permission));
}
