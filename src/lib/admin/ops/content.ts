import { recordAudit, stripUndefined } from "@/lib/admin/audit";
import { assertPermission, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import type { AdminDataStore } from "@/lib/admin/store/types";
import type { HomepageContent, ImageRef, SiteContentDoc, SiteSettings } from "@/lib/admin/types";
import { isValidEmail, normalizeGhanaPhone } from "@/lib/admin/validation";

/* --------------------------------------------------------------- Homepage */

export const DEFAULT_HOMEPAGE: HomepageContent = {
  hero: {
    eyebrow: "YOUR NEXT FAVOURITE READ AWAITS",
    heading: "A little more bookish. A lot more delight.",
    intro: "Stories for curious minds, growing imaginations, and everyone in between. Find the books you’ll love, delivered wherever you are in Ghana.",
    ctaLabel: "Explore the shelves",
    ctaHref: "/shop",
  },
  announcement: { text: "A good story can take you anywhere. We deliver books across Ghana.", enabled: true },
  featuredShelves: [{ id: "shelf-main", title: "Good books, great finds.", bookIds: [] }],
  ghanaianPicks: [],
  trustPoints: ["Delivered across Ghana", "Brand new & preloved books", "Pay securely online", "Carefully packed with love"],
  deliveryCopy: "Delivery prices are shown at checkout before you pay.",
};

export async function getHomepage(store: AdminDataStore, ctx: StaffContext): Promise<SiteContentDoc> {
  assertPermission(ctx, "content.view");
  return (await store.get("siteContent", "homepage")) ?? { id: "homepage", draft: DEFAULT_HOMEPAGE, updatedAt: nowIso(), updatedBy: "system" };
}

function validateHomepage(content: HomepageContent, publishedBookIds: Set<string>): string[] {
  const problems: string[] = [];
  if (!content.hero.heading.trim()) problems.push("Hero heading is required.");
  if (content.hero.heading.length > 120) problems.push("Hero heading should be under 120 characters.");
  if (content.hero.image && !content.hero.image.alt.trim()) problems.push("Hero image needs alt text.");
  if (!/^\/(?!\/)/.test(content.hero.ctaHref)) problems.push("Hero button must link to a page on this site (start with /).");
  if (content.announcement.text.length > 140) problems.push("Announcement should be under 140 characters.");
  for (const shelf of content.featuredShelves) {
    const missing = shelf.bookIds.filter((id) => !publishedBookIds.has(id));
    if (missing.length) problems.push(`Shelf “${shelf.title}” includes ${missing.length} book(s) that are not published.`);
  }
  const missingPicks = content.ghanaianPicks.filter((id) => !publishedBookIds.has(id));
  if (missingPicks.length) problems.push(`Ghanaian stories includes ${missingPicks.length} unpublished book(s).`);
  return problems;
}

export async function saveHomepageDraft(store: AdminDataStore, ctx: StaffContext, draft: HomepageContent, idempotencyKey: string) {
  assertPermission(ctx, "content.edit");
  if (draft.featuredShelves.length > 6) throw new AdminError("invalid", "Up to 6 featured shelves.");
  return runIdempotent(store, ctx, "content.homepage.draft", idempotencyKey, async (tx) => {
    const current = await tx.get("siteContent", "homepage");
    const at = nowIso();
    const doc: SiteContentDoc = stripUndefined({ ...(current ?? { id: "homepage" as const }), id: "homepage", draft, updatedAt: at, updatedBy: ctx.uid });
    tx.set("siteContent", "homepage", doc);
    recordAudit(tx, ctx, { action: "content.homepage.draft", entityType: "siteContent", entityId: "homepage", summary: "Saved homepage draft" });
    return { saved: true };
  });
}

export async function setHeroImage(store: AdminDataStore, ctx: StaffContext, image: ImageRef, idempotencyKey: string) {
  assertPermission(ctx, "content.edit");
  return runIdempotent(store, ctx, "content.homepage.hero", idempotencyKey, async (tx) => {
    const current = (await tx.get("siteContent", "homepage")) ?? { id: "homepage" as const, draft: DEFAULT_HOMEPAGE, updatedAt: nowIso(), updatedBy: ctx.uid };
    const previous = current.draft.hero.image?.path ?? null;
    tx.set("siteContent", "homepage", { ...current, draft: { ...current.draft, hero: { ...current.draft.hero, image } }, updatedAt: nowIso(), updatedBy: ctx.uid });
    recordAudit(tx, ctx, { action: "content.homepage.heroImage", entityType: "siteContent", entityId: "homepage", summary: "Replaced hero image in draft" });
    // Only clean up the old file if the published version is not still using it.
    const stillPublished = current.published?.hero.image?.path === previous;
    return { previousPath: stillPublished ? null : previous };
  });
}

export async function publishHomepage(store: AdminDataStore, ctx: StaffContext, idempotencyKey: string) {
  assertPermission(ctx, "content.publish");
  return runIdempotent(store, ctx, "content.homepage.publish", idempotencyKey, async (tx) => {
    const current = await tx.get("siteContent", "homepage");
    if (!current) throw new AdminError("precondition", "Save a draft first.");
    const published = await tx.query("books", { where: [["status", "==", "published"]] });
    const problems = validateHomepage(current.draft, new Set(published.map((book) => book.id)));
    if (problems.length) throw new AdminError("precondition", problems.join(" "));
    const at = nowIso();
    tx.set("siteContent", "homepage", { ...current, published: current.draft, publishedAt: at, publishedBy: ctx.uid, updatedAt: at, updatedBy: ctx.uid });
    recordAudit(tx, ctx, { action: "content.homepage.publish", entityType: "siteContent", entityId: "homepage", summary: "Published homepage" });
    return { publishedAt: at };
  });
}

/* --------------------------------------------------------------- Settings */

export const DEFAULT_SETTINGS: Omit<SiteSettings, "updatedAt" | "updatedBy"> = {
  id: "site",
  supportPhone: "",
  supportEmail: "",
  supportWhatsApp: "",
  fulfilmentOrigin: { region: "Greater Accra", city: "Accra", addressLine: "" },
  returnsPolicyUrl: "/returns",
  defaultLowStockThreshold: 3,
  checkoutEnabled: false,
  smsEnabled: false,
  maintenanceBanner: "",
};

export async function getSettings(store: AdminDataStore, ctx: StaffContext): Promise<SiteSettings> {
  assertPermission(ctx, "settings.view");
  return (await store.get("siteSettings", "site")) ?? { ...DEFAULT_SETTINGS, updatedAt: nowIso(), updatedBy: "system" };
}

export type SettingsInput = Omit<SiteSettings, "id" | "updatedAt" | "updatedBy">;

export async function updateSettings(store: AdminDataStore, ctx: StaffContext, input: SettingsInput, idempotencyKey: string) {
  assertPermission(ctx, "settings.edit");
  if (input.smsEnabled) throw new AdminError("precondition", "Transactional SMS is unavailable until mNotify delivery and status handling are connected.");
  const errors: Record<string, string> = {};
  if (input.supportPhone && !normalizeGhanaPhone(input.supportPhone)) errors.supportPhone = "Enter a Ghana phone number.";
  if (input.supportWhatsApp && !normalizeGhanaPhone(input.supportWhatsApp)) errors.supportWhatsApp = "Enter a Ghana phone number.";
  if (input.supportEmail && !isValidEmail(input.supportEmail)) errors.supportEmail = "Enter a valid email.";
  if (!/^(\/|https:\/\/)/.test(input.returnsPolicyUrl)) errors.returnsPolicyUrl = "Use a site path (/returns) or an https:// link.";
  if (!Number.isInteger(input.defaultLowStockThreshold) || input.defaultLowStockThreshold < 0 || input.defaultLowStockThreshold > 100) errors.defaultLowStockThreshold = "0–100.";
  if (input.maintenanceBanner.length > 160) errors.maintenanceBanner = "Max 160 characters.";
  if (Object.keys(errors).length) throw new AdminError("invalid", "Please fix the highlighted fields.", errors);
  return runIdempotent(store, ctx, "settings.update", idempotencyKey, async (tx) => {
    const current = await tx.get("siteSettings", "site");
    const next: SiteSettings = { ...DEFAULT_SETTINGS, ...input, id: "site", updatedAt: nowIso(), updatedBy: ctx.uid };
    tx.set("siteSettings", "site", next);
    const toggles: string[] = [];
    if (current?.checkoutEnabled !== next.checkoutEnabled) toggles.push(`checkout ${next.checkoutEnabled ? "on" : "off"}`);
    if (current?.smsEnabled !== next.smsEnabled) toggles.push(`SMS ${next.smsEnabled ? "on" : "off"}`);
    recordAudit(tx, ctx, { action: "settings.update", entityType: "siteSettings", entityId: "site", summary: `Updated site settings${toggles.length ? ` (${toggles.join(", ")})` : ""}` });
    return { saved: true };
  });
}
