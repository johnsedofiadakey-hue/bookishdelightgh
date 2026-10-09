/**
 * Admin-side view of the shared Bookish Delight commerce model.
 *
 * These shapes mirror the collection contract in PROJECT_PLAN.md §4. The shared
 * owner (Codex) is expected to publish the canonical versions in
 * `src/lib/contracts`; until then the admin keeps them here so the two sides
 * cannot silently drift. See ADMIN_INTEGRATION_NOTES.md.
 *
 * Rules carried by every type below:
 * - Money is integer pesewas.
 * - Timestamps are ISO-8601 strings at the adapter boundary (the Firestore
 *   adapter converts to/from Firestore Timestamps).
 * - `available = onHand - reserved` is derived, never stored as truth.
 */

import type { ItemCondition, PrelovedGrade } from "@/lib/contracts/catalog";

export type { ItemCondition, PrelovedGrade };

export const SCHEMA_VERSION = 1;

export type IsoTime = string;

/* ------------------------------------------------------------------ Staff */

export const STAFF_ROLES = ["owner", "manager", "catalogue_editor", "fulfilment", "support", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffStatus = "active" | "suspended" | "revoked";

export interface AdminProfile {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  status: StaffStatus;
  /** Sessions issued before this instant are rejected (forced sign-out). */
  sessionsValidAfter: IsoTime;
  createdAt: IsoTime;
  createdBy: string;
  updatedAt: IsoTime;
  lastActiveAt?: IsoTime;
  schemaVersion: number;
}

export interface AdminSession {
  id: string;
  /** SHA-256 of the opaque cookie secret; the raw secret is never stored. */
  secretHash: string;
  uid: string;
  createdAt: IsoTime;
  expiresAt: IsoTime;
  revokedAt?: IsoTime;
  userAgent?: string;
}

/* -------------------------------------------------------------- Catalogue */

export const BOOK_FORMATS = ["Paperback", "Hardcover", "Board book", "Box set", "Spiral bound", "Activity book", "Workbook", "Flashcards", "Bundle"] as const;
export type AdminBookFormat = (typeof BOOK_FORMATS)[number];

export const AGE_BANDS = ["0-3", "4-7", "8-12", "13-17"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type PublishStatus = "draft" | "published" | "archived";

export interface ImageRef {
  /** Storage object path, e.g. `covers/{bookId}/{imageId}.webp`. */
  path: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  bytes: number;
  contentType: string;
}

export interface Book {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  description: string;
  language: string;
  ageBand: AgeBand;
  categoryIds: string[];
  tags: string[];
  cover?: ImageRef;
  gallery: ImageRef[];
  seoTitle?: string;
  seoDescription?: string;
  relatedBookIds: string[];
  status: PublishStatus;
  publishedAt?: IsoTime;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  updatedBy: string;
  schemaVersion: number;
}

export interface BookVariant {
  /** The SKU is the document ID and is globally unique. */
  sku: string;
  bookId: string;
  format: AdminBookFormat;
  /** Missing on records created before conditions existed: treat as "new". */
  condition?: ItemCondition;
  /** Required when `condition` is "preloved". */
  conditionGrade?: PrelovedGrade;
  conditionNote?: string;
  edition?: string;
  isbn?: string;
  pricePesewas: number;
  /** Optional "worth if bought separately" price, shown as a saving. Must be above the price. */
  compareAtPesewas?: number;
  /** Bundles (format "Bundle") only: what's inside. Items with a SKU can be made up from stock. */
  bundleItems?: BundleItem[];
  /** Optional cost price; only visible with `finance.view`. */
  costPesewas?: number;
  weightGrams: number;
  active: boolean;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  updatedBy: string;
  schemaVersion: number;
}

export interface BundleItem {
  /** A SKU you also stock individually. Making up a bundle moves these copies into it. */
  sku?: string;
  /** What the customer sees, e.g. "The Gruffalo". Filled from the SKU's book when linked. */
  title: string;
  quantity: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  caption?: string;
  order: number;
  image?: ImageRef;
  published: boolean;
  updatedAt: IsoTime;
}

/* -------------------------------------------------------------- Inventory */

export interface InventoryRecord {
  sku: string;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
  /** Bumped on every write; lets the Firestore adapter detect conflicts. */
  version: number;
  updatedAt: IsoTime;
}

export const MOVEMENT_TYPES = [
  "STOCK_RECEIVED",
  "ADJUST_DAMAGE",
  "ADJUST_CORRECTION",
  "RETURN_TO_STOCK",
  "OFFSITE_SALE",
  "ORDER_RESERVED",
  "ORDER_RELEASED",
  "ORDER_SOLD",
  "ORDER_CANCELLED_RESTOCK",
  "BUNDLE_ASSEMBLED",
  "BUNDLE_UNPACKED",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export interface StockMovement {
  id: string;
  sku: string;
  type: MovementType;
  /** Signed change to `onHand`. */
  onHandDelta: number;
  /** Signed change to `reserved`. */
  reservedDelta: number;
  onHandAfter: number;
  reservedAfter: number;
  reason: string;
  reference: string;
  actorUid: string;
  actorName: string;
  orderId?: string;
  createdAt: IsoTime;
}

/* ----------------------------------------------------------------- Orders */

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "abandoned", "refund_pending", "partially_refunded", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILMENT_STATUSES = ["new", "picking", "packed", "dispatched", "delivered", "cancelled", "returned", "exception"] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export type OrderChannel = "website" | "manual";
export type ManualChannel = "instagram" | "whatsapp" | "phone" | "walk_in" | "other";

export interface OrderLineSnapshot {
  sku: string;
  bookId: string;
  title: string;
  /** Display name of the option bought, e.g. "Paperback · Preloved · Very good". */
  format: string;
  condition?: ItemCondition;
  conditionGrade?: PrelovedGrade;
  isbn?: string;
  unitPricePesewas: number;
  quantity: number;
  lineTotalPesewas: number;
}

export interface DeliveryAddressSnapshot {
  region: string;
  city: string;
  addressLine: string;
  ghanaPostGps?: string;
  landmark?: string;
  notes?: string;
}

export interface DeliverySnapshot {
  rateId: string;
  rateVersion: number;
  serviceLevel: string;
  pricePesewas: number;
  estimate: string;
}

export interface CustomerSnapshot {
  name: string;
  email?: string;
  phone: string;
}

export interface FulfilmentEvent {
  from: FulfilmentStatus | null;
  to: FulfilmentStatus;
  actorUid: string;
  actorName: string;
  at: IsoTime;
  note?: string;
}

export interface StaffNote {
  id: string;
  body: string;
  actorUid: string;
  actorName: string;
  at: IsoTime;
}

export interface Order {
  id: string;
  /** Human reference shown to customers, e.g. BD-24K7Q2. */
  ref: string;
  channel: OrderChannel;
  manualChannel?: ManualChannel;
  customer: CustomerSnapshot;
  address: DeliveryAddressSnapshot;
  lines: OrderLineSnapshot[];
  delivery: DeliverySnapshot;
  discountPesewas: number;
  promotionCode?: string;
  subtotalPesewas: number;
  totalPesewas: number;
  currency: "GHS";
  paymentStatus: PaymentStatus;
  paymentId?: string;
  paystackReference?: string;
  fulfilmentStatus: FulfilmentStatus;
  fulfilmentHistory: FulfilmentEvent[];
  courier?: string;
  trackingReference?: string;
  dispatchedAt?: IsoTime;
  deliveredAt?: IsoTime;
  deliveryProofNote?: string;
  exception?: { kind: "late_payment_no_stock" | "payment_mismatch" | "stock_conflict" | "delivery_failed" | "other"; detail: string; raisedAt: IsoTime; resolvedAt?: IsoTime };
  stockState: "reserved" | "sold" | "released" | "restocked";
  /** Website orders: when unpaid reserved stock is released back to the shelf. */
  reservationExpiresAt?: IsoTime;
  staffNotes: StaffNote[];
  createdAt: IsoTime;
  paidAt?: IsoTime;
  updatedAt: IsoTime;
  schemaVersion: number;
}

export type PaymentProvider = "paystack" | "manual";

export interface RefundRecord {
  id: string;
  amountPesewas: number;
  reason: string;
  status: "requested" | "processing" | "processed" | "failed";
  providerReference?: string;
  requestedBy: string;
  requestedAt: IsoTime;
  updatedAt: IsoTime;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  /** Paystack transaction reference, or the manual evidence reference. */
  reference: string;
  amountPesewas: number;
  currency: "GHS";
  providerStatus: string;
  verified: boolean;
  /** Manual payments only. */
  manualMethod?: "momo" | "bank_transfer" | "cash" | "pos_card";
  manualEvidence?: string;
  approvedBy?: string;
  approvedAt?: IsoTime;
  verificationHistory: { at: IsoTime; status: string; source: "webhook" | "callback" | "verify_api" | "staff" }[];
  refunds: RefundRecord[];
  createdAt: IsoTime;
  updatedAt: IsoTime;
}

/* --------------------------------------------------------------- Delivery */

export interface DeliveryRate {
  id: string;
  /** All versions of one rate share a family ID. */
  familyId: string;
  version: number;
  name: string;
  region: string;
  /** Empty array means the rate applies to the whole region. */
  cities: string[];
  serviceLevel: "standard" | "express" | "pickup";
  minWeightGrams: number;
  maxWeightGrams: number;
  minOrderPesewas: number;
  pricePesewas: number;
  estimate: string;
  activeFrom: IsoTime;
  activeTo?: IsoTime;
  active: boolean;
  supersededBy?: string;
  createdAt: IsoTime;
  createdBy: string;
}

/* ------------------------------------------------------------- Promotions */

export interface Promotion {
  id: string;
  code: string;
  kind: "fixed" | "percent";
  /** Pesewas for fixed, basis points (1% = 100) for percent. */
  value: number;
  minOrderPesewas: number;
  eligibleCategoryIds: string[];
  usageLimit?: number;
  perCustomerLimit?: number;
  usedCount: number;
  startsAt: IsoTime;
  endsAt?: IsoTime;
  active: boolean;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  updatedBy: string;
}

/* ---------------------------------------------------------------- Content */

export interface HomepageContent {
  hero: { eyebrow: string; heading: string; intro: string; image?: ImageRef; ctaLabel: string; ctaHref: string };
  announcement: { text: string; enabled: boolean };
  featuredShelves: { id: string; title: string; bookIds: string[] }[];
  ghanaianPicks: string[];
  trustPoints: string[];
  deliveryCopy: string;
}

export interface SiteContentDoc {
  id: "homepage";
  draft: HomepageContent;
  published?: HomepageContent;
  publishedAt?: IsoTime;
  publishedBy?: string;
  updatedAt: IsoTime;
  updatedBy: string;
}

export interface SiteSettings {
  id: "site";
  supportPhone: string;
  supportEmail: string;
  supportWhatsApp: string;
  fulfilmentOrigin: { region: string; city: string; addressLine: string };
  returnsPolicyUrl: string;
  defaultLowStockThreshold: number;
  checkoutEnabled: boolean;
  smsEnabled: boolean;
  maintenanceBanner: string;
  updatedAt: IsoTime;
  updatedBy: string;
}

/* ---------------------------------------------------------- Notifications */

export const NOTIFICATION_EVENTS = ["order_paid", "order_dispatched", "order_delivered", "order_cancelled", "refund_processed"] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface NotificationRecord {
  id: string;
  /** `${orderId}:${event}` — the uniqueness guard against duplicate SMS. */
  eventKey: string;
  event: NotificationEvent;
  orderId: string;
  recipient: string;
  template: string;
  templateVersion: number;
  status: "queued" | "sending" | "sent" | "delivered" | "failed" | "suppressed";
  mnotifyCampaignId?: string;
  attempts: number;
  lastError?: string;
  createdAt: IsoTime;
  updatedAt: IsoTime;
}

/* ------------------------------------------------------------------ Audit */

export interface AuditEvent {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: StaffRole | "system";
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  requestId: string;
  at: IsoTime;
}

export interface IdempotencyRecord {
  key: string;
  scope: string;
  actorUid: string;
  resultJson: string;
  createdAt: IsoTime;
}

/* --------------------------------------------------------- Collection map */

export interface AdminCollections {
  adminProfiles: AdminProfile;
  adminSessions: AdminSession;
  books: Book;
  bookVariants: BookVariant;
  categories: Category;
  inventory: InventoryRecord;
  stockMovements: StockMovement;
  orders: Order;
  payments: PaymentRecord;
  deliveryRates: DeliveryRate;
  promotions: Promotion;
  siteContent: SiteContentDoc;
  siteSettings: SiteSettings;
  notifications: NotificationRecord;
  auditEvents: AuditEvent;
  idempotencyKeys: IdempotencyRecord;
}

export type CollectionName = keyof AdminCollections;
