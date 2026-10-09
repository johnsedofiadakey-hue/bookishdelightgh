/** Shared shapes for storefront, commerce services, and the admin portal. */
export type Currency = "GHS";

export type PaymentStatus =
  | "pending"
  | "initialized"
  | "paid"
  | "failed"
  | "expired"
  | "refund_pending"
  | "refunded"
  | "payment_exception";

export type FulfilmentStatus =
  | "new"
  | "picking"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "returned"
  | "fulfilment_exception";

export type StockMovementType =
  | "STOCK_RECEIVED"
  | "STOCK_ADJUSTED"
  | "STOCK_DAMAGED"
  | "STOCK_RESERVED"
  | "RESERVATION_RELEASED"
  | "STOCK_SOLD"
  | "STOCK_RETURNED"
  | "OFFSITE_SALE";

export interface InventoryRecord {
  sku: string;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
  updatedAt: unknown; // Firestore Timestamp in stored documents.
}

export function availableStock(inventory: Pick<InventoryRecord, "onHand" | "reserved">): number {
  return inventory.onHand - inventory.reserved;
}

export interface StockMovement {
  id: string;
  sku: string;
  type: StockMovementType;
  quantityDelta: number;
  reason: string;
  actorId: string;
  reference: string;
  idempotencyKey: string;
  createdAt: unknown;
}

export interface OrderAddress {
  region: string;
  city: string;
  streetAddress: string;
  ghanaPostGps?: string;
  landmark?: string;
  deliveryNotes?: string;
}

export interface OrderLineSnapshot {
  sku: string;
  bookId: string;
  title: string;
  author: string;
  format: string;
  isbn?: string;
  quantity: number;
  unitPricePesewas: number;
  lineTotalPesewas: number;
}

export interface OrderRecord {
  id: string;
  orderReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: OrderAddress;
  lines: OrderLineSnapshot[];
  subtotalPesewas: number;
  discountPesewas: number;
  deliveryPesewas: number;
  totalPesewas: number;
  currency: Currency;
  deliveryRateId: string;
  deliveryRateVersion: number;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  paymentReference?: string;
  reservationExpiresAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DeliveryRate {
  id: string;
  version: number;
  region: string;
  cityPattern?: string;
  serviceLevel: string;
  minWeightGrams: number;
  maxWeightGrams: number;
  pricePesewas: number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  active: boolean;
}

export type AdminRole = "owner" | "manager" | "catalogue_editor" | "fulfilment" | "support" | "viewer";

export interface AdminProfile {
  uid: string;
  displayName: string;
  role: AdminRole;
  permissions: string[];
  active: boolean;
  updatedAt: unknown;
}
