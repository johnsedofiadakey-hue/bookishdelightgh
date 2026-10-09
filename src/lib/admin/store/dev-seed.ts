import { getDevelopmentIdentity } from "@/lib/admin/auth/identity";
import { DEFAULT_HOMEPAGE, DEFAULT_SETTINGS } from "@/lib/admin/ops/content";
import { notificationIdFor } from "@/lib/admin/ops/notifications";
import { RECOMMENDED_CATEGORIES } from "@/lib/admin/recommended-categories";
import type { MemoryAdminStore } from "@/lib/admin/store/memory";
import { SCHEMA_VERSION, STAFF_ROLES, type AdminProfile, type Book, type BookVariant, type Category, type DeliveryRate, type InventoryRecord, type NotificationRecord, type Order, type PaymentRecord, type StockMovement } from "@/lib/admin/types";

/**
 * DEVELOPMENT FIXTURES ONLY. Loaded into the in-memory store so the admin can
 * be exercised locally. Every name is marked “DEV” / “Sample”. This never runs
 * against Firestore: the Firestore adapter has no seed path.
 */

export const DEV_STAFF: { uid: string; email: string; displayName: string; role: AdminProfile["role"] }[] = STAFF_ROLES.map((role) => ({
  uid: `dev-${role.replace("_", "-")}`,
  email: `${role.replace("_", ".")}@dev.bookish.test`,
  displayName: `Dev ${role.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}`,
  role,
}));

export function seedDevelopmentStore(store: MemoryAdminStore): void {
  const t0 = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

  const identity = getDevelopmentIdentity();
  for (const staff of DEV_STAFF) {
    identity.users.set(staff.uid, { uid: staff.uid, email: staff.email, displayName: staff.displayName, staffClaim: true, disabled: false });
    store.seed("adminProfiles", staff.uid, {
      uid: staff.uid,
      email: staff.email,
      displayName: staff.displayName,
      role: staff.role,
      status: "active",
      sessionsValidAfter: t0,
      createdAt: t0,
      createdBy: "dev-seed",
      updatedAt: t0,
      schemaVersion: SCHEMA_VERSION,
    });
  }
  // A Firebase user without a staff profile, to exercise provisioning.
  identity.users.set("dev-new-hire", { uid: "dev-new-hire", email: "new.hire@dev.bookish.test", displayName: "Dev New Hire", staffClaim: false, disabled: false });

  store.seed("siteSettings", "site", { ...DEFAULT_SETTINGS, supportEmail: "support@dev.bookish.test", smsEnabled: true, checkoutEnabled: true, updatedAt: t0, updatedBy: "dev-seed" });
  store.seed("siteContent", "homepage", { id: "homepage", draft: DEFAULT_HOMEPAGE, updatedAt: t0, updatedBy: "dev-seed" });

  const categories: Category[] = RECOMMENDED_CATEGORIES.map((category) => ({ id: category.slug, slug: category.slug, name: category.name, caption: category.caption, order: category.order, published: true, updatedAt: t0 }));
  for (const category of categories) store.seed("categories", category.id, category);

  const rates: Omit<DeliveryRate, "familyId" | "version" | "active" | "createdAt" | "createdBy" | "activeFrom">[] = [
    { id: "rate_dev_accra", name: "DEV Accra metro standard", region: "Greater Accra", cities: ["Accra", "Tema", "Madina", "Osu"], serviceLevel: "standard", minWeightGrams: 0, maxWeightGrams: 5000, minOrderPesewas: 0, pricePesewas: 2500, estimate: "1–2 working days" },
    { id: "rate_dev_gar", name: "DEV Greater Accra region", region: "Greater Accra", cities: [], serviceLevel: "standard", minWeightGrams: 0, maxWeightGrams: 5000, minOrderPesewas: 0, pricePesewas: 3500, estimate: "2–3 working days" },
    { id: "rate_dev_ashanti", name: "DEV Ashanti standard", region: "Ashanti", cities: [], serviceLevel: "standard", minWeightGrams: 0, maxWeightGrams: 5000, minOrderPesewas: 0, pricePesewas: 4500, estimate: "2–4 working days" },
    { id: "rate_dev_north", name: "DEV Northern standard", region: "Northern", cities: [], serviceLevel: "standard", minWeightGrams: 0, maxWeightGrams: 5000, minOrderPesewas: 0, pricePesewas: 6500, estimate: "3–5 working days" },
  ];
  for (const rate of rates) store.seed("deliveryRates", rate.id, { ...rate, familyId: rate.id, version: 1, active: true, activeFrom: t0, createdAt: t0, createdBy: "dev-seed" });

  const books: { book: Book; variant: BookVariant; onHand: number }[] = [
    ["sample-mango", "the-mango-season", "The Mango Season (Sample)", "A. Mensah", ["chapter-books"], "8-12", "SAMPLE-MANGO-PB", "Paperback", 9500, 320, 8],
    ["sample-sky", "little-sky-explorer", "Little Sky Explorer (Sample)", "N. Adjei", ["story-collections"], "4-7", "SAMPLE-SKY-HC", "Hardcover", 12000, 450, 5],
    ["sample-begin", "phonics-starter-set", "Phonics Starter Set, 12 books (Sample)", "", ["early-readers"], "4-7", "SAMPLE-PHONICS-BOX", "Box set", 11000, 300, 12],
    ["sample-atlas", "atlas-of-wonder", "Atlas of Wonder (Sample)", "K. Owusu", ["reference"], "8-12", "SAMPLE-ATLAS-HC", "Hardcover", 14500, 900, 2],
  ].map(([id, slug, title, author, categoryIds, ageBand, sku, format, price, weight, onHand]) => ({
    book: {
      id: id as string,
      slug: slug as string,
      title: title as string,
      authors: author ? [author as string] : [],
      description: "Illustrative sample description for local development only. Replace with approved catalogue data.",
      language: "English",
      ageBand: ageBand as Book["ageBand"],
      categoryIds: categoryIds as string[],
      tags: ["sample"],
      gallery: [],
      relatedBookIds: [],
      // Two samples are published so local checkout can be exercised end to end.
      status: id === "sample-sky" || id === "sample-begin" ? "published" : "draft",
      createdAt: t0,
      updatedAt: t0,
      updatedBy: "dev-seed",
      schemaVersion: SCHEMA_VERSION,
    },
    variant: { sku: sku as string, bookId: id as string, format: format as BookVariant["format"], condition: "new", pricePesewas: price as number, costPesewas: Math.round((price as number) * 0.6), weightGrams: weight as number, active: true, createdAt: t0, updatedAt: t0, updatedBy: "dev-seed", schemaVersion: SCHEMA_VERSION },
    onHand: onHand as number,
  }));

  // A preloved copy of a published sample, so both conditions show on one book page.
  books.push({
    book: books.find((entry) => entry.book.id === "sample-sky")!.book,
    variant: { sku: "SAMPLE-SKY-HC-PL-VG", bookId: "sample-sky", format: "Hardcover", condition: "preloved", conditionGrade: "very_good", conditionNote: "Light wear on the corners; a name written inside the cover.", pricePesewas: 6000, costPesewas: 2500, weightGrams: 450, active: true, createdAt: t0, updatedAt: t0, updatedBy: "dev-seed", schemaVersion: SCHEMA_VERSION },
    onHand: 2,
  });

  // A sample bundle built from two stocked samples; staff make it up from stock in Inventory.
  books.push({
    book: { ...books[0].book, id: "sample-bundle", slug: "starter-readers-bundle", title: "Starter Readers Bundle (Sample)", authors: [], categoryIds: ["bundles", "early-readers"], ageBand: "4-7", status: "published", description: "Illustrative sample bundle for local development only: a phonics box set and a story collection at a discount." },
    variant: { sku: "SAMPLE-BUNDLE-STARTER", bookId: "sample-bundle", format: "Bundle", condition: "mixed", pricePesewas: 15000, compareAtPesewas: 17000, bundleItems: [{ sku: "SAMPLE-PHONICS-BOX", title: "Phonics Starter Set, 12 books (Sample)", quantity: 1 }, { sku: "SAMPLE-SKY-HC-PL-VG", title: "Little Sky Explorer (Sample)", quantity: 1 }], weightGrams: 750, active: true, createdAt: t0, updatedAt: t0, updatedBy: "dev-seed", schemaVersion: SCHEMA_VERSION },
    onHand: 0,
  });

  const inventory = new Map<string, InventoryRecord>();
  for (const { book, variant, onHand } of books) {
    store.seed("books", book.id, book);
    store.seed("bookVariants", variant.sku, variant);
    const movement: StockMovement = { id: `mov_dev_open_${variant.sku}`, sku: variant.sku, type: "STOCK_RECEIVED", onHandDelta: onHand, reservedDelta: 0, onHandAfter: onHand, reservedAfter: 0, reason: "DEV opening stock", reference: "DEV-SEED", actorUid: "dev-seed", actorName: "Dev seed", createdAt: t0 };
    if (onHand > 0) store.seed("stockMovements", movement.id, movement);
    inventory.set(variant.sku, { sku: variant.sku, onHand, reserved: 0, lowStockThreshold: 3, version: 1, updatedAt: t0 });
  }

  const sample = (index: number) => books[index];
  const makeOrder = (spec: {
    id: string;
    ref: string;
    hoursAgo: number;
    lines: [number, number][];
    region: string;
    city: string;
    rate: string;
    ratePrice: number;
    paymentStatus: Order["paymentStatus"];
    fulfilmentStatus: Order["fulfilmentStatus"];
    name: string;
    phone: string;
  }): Order => {
    const lines = spec.lines.map(([index, quantity]) => {
      const { book, variant } = sample(index);
      return { sku: variant.sku, bookId: book.id, title: book.title, format: variant.format, unitPricePesewas: variant.pricePesewas, quantity, lineTotalPesewas: variant.pricePesewas * quantity };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotalPesewas, 0);
    const created = at(spec.hoursAgo);
    const paid = spec.paymentStatus === "paid";
    const history: Order["fulfilmentHistory"] = [{ from: null, to: "new", actorUid: "system", actorName: "Checkout", at: created }];
    if (spec.fulfilmentStatus === "dispatched") {
      history.push({ from: "new", to: "picking", actorUid: "dev-fulfilment", actorName: "Dev Fulfilment", at: at(spec.hoursAgo - 2) });
      history.push({ from: "picking", to: "packed", actorUid: "dev-fulfilment", actorName: "Dev Fulfilment", at: at(spec.hoursAgo - 3) });
      history.push({ from: "packed", to: "dispatched", actorUid: "dev-fulfilment", actorName: "Dev Fulfilment", at: at(spec.hoursAgo - 4) });
    }
    return {
      id: spec.id,
      ref: spec.ref,
      channel: "website",
      customer: { name: spec.name, phone: spec.phone, email: `${spec.id}@dev.bookish.test` },
      address: { region: spec.region, city: spec.city, addressLine: "DEV sample address", landmark: "Near the sample landmark" },
      lines,
      delivery: { rateId: spec.rate, rateVersion: 1, serviceLevel: "standard", pricePesewas: spec.ratePrice, estimate: "Sample estimate" },
      discountPesewas: 0,
      subtotalPesewas: subtotal,
      totalPesewas: subtotal + spec.ratePrice,
      currency: "GHS",
      paymentStatus: spec.paymentStatus,
      paymentId: `pay_${spec.id}`,
      paystackReference: `DEV-PSK-${spec.ref}`,
      fulfilmentStatus: spec.fulfilmentStatus,
      fulfilmentHistory: history,
      ...(spec.fulfilmentStatus === "dispatched" ? { courier: "DEV Courier", trackingReference: "DEV-TRK-001", dispatchedAt: at(spec.hoursAgo - 4) } : {}),
      stockState: paid ? "sold" : "reserved",
      staffNotes: [],
      createdAt: created,
      ...(paid ? { paidAt: at(spec.hoursAgo - 0.1) } : {}),
      updatedAt: created,
      schemaVersion: SCHEMA_VERSION,
    };
  };

  const orders = [
    makeOrder({ id: "ord_dev_paid1", ref: "BD-DEV001", hoursAgo: 20, lines: [[0, 1], [1, 1]], region: "Greater Accra", city: "Accra", rate: "rate_dev_accra", ratePrice: 2500, paymentStatus: "paid", fulfilmentStatus: "new", name: "Sample Customer A", phone: "+233200000001" }),
    makeOrder({ id: "ord_dev_unpaid", ref: "BD-DEV002", hoursAgo: 3, lines: [[2, 1]], region: "Ashanti", city: "Kumasi", rate: "rate_dev_ashanti", ratePrice: 4500, paymentStatus: "pending", fulfilmentStatus: "new", name: "Sample Customer B", phone: "+233200000002" }),
    makeOrder({ id: "ord_dev_transit", ref: "BD-DEV003", hoursAgo: 50, lines: [[3, 1]], region: "Northern", city: "Tamale", rate: "rate_dev_north", ratePrice: 6500, paymentStatus: "paid", fulfilmentStatus: "dispatched", name: "Sample Customer C", phone: "+233200000003" }),
  ];

  for (const order of orders) {
    store.seed("orders", order.id, order);
    const payment: PaymentRecord = {
      id: order.paymentId!,
      orderId: order.id,
      provider: "paystack",
      reference: order.paystackReference!,
      amountPesewas: order.totalPesewas,
      currency: "GHS",
      providerStatus: order.paymentStatus === "paid" ? "success" : "pending",
      verified: order.paymentStatus === "paid",
      verificationHistory: order.paymentStatus === "paid" ? [{ at: order.paidAt!, status: "success", source: "webhook" }] : [],
      refunds: [],
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    };
    store.seed("payments", payment.id, payment);
    order.lines.forEach((line, index) => {
      const record = inventory.get(line.sku)!;
      const sold = order.stockState === "sold";
      const next = { ...record, onHand: record.onHand - (sold ? line.quantity : 0), reserved: record.reserved + (sold ? 0 : line.quantity), version: record.version + 1 };
      inventory.set(line.sku, next);
      store.seed("stockMovements", `mov_dev_${order.id}_${index}`, {
        id: `mov_dev_${order.id}_${index}`,
        sku: line.sku,
        type: sold ? "ORDER_SOLD" : "ORDER_RESERVED",
        onHandDelta: sold ? -line.quantity : 0,
        reservedDelta: sold ? 0 : line.quantity,
        onHandAfter: next.onHand,
        reservedAfter: next.reserved,
        reason: sold ? "DEV paid website order" : "DEV pending website order",
        reference: order.ref,
        actorUid: "system",
        actorName: "Checkout",
        orderId: order.id,
        createdAt: order.createdAt,
      });
    });
  }
  for (const record of inventory.values()) store.seed("inventory", record.sku, record);

  const notifications: NotificationRecord[] = [
    { id: notificationIdFor("ord_dev_paid1:order_paid"), eventKey: "ord_dev_paid1:order_paid", event: "order_paid", orderId: "ord_dev_paid1", recipient: "+233200000001", template: "order_paid", templateVersion: 1, status: "failed", attempts: 2, lastError: "DEV sample: provider timeout", createdAt: at(19.9), updatedAt: at(19) },
    { id: notificationIdFor("ord_dev_transit:order_paid"), eventKey: "ord_dev_transit:order_paid", event: "order_paid", orderId: "ord_dev_transit", recipient: "+233200000003", template: "order_paid", templateVersion: 1, status: "delivered", mnotifyCampaignId: "DEV-CAMPAIGN-1", attempts: 1, createdAt: at(49.9), updatedAt: at(49.8) },
  ];
  for (const record of notifications) store.seed("notifications", record.id, record);
}
