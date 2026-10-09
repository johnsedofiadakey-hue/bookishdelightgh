import { formatGhs } from "@/lib/contracts/catalog";
import type { FulfilmentStatus, PaymentStatus } from "@/lib/admin/types";

export { formatGhs };

/** Parse a staff-entered GHS amount ("95", "95.50", "GH₵ 1,200") into integer pesewas. */
export function parseGhsToPesewas(input: string): number | null {
  const cleaned = input.replace(/gh₵|ghs|gh¢|,|\s/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const pesewas = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(pesewas) ? pesewas : null;
}

/** Pesewas → plain decimal string for form fields and CSV ("95.50"). */
export function pesewasToDecimal(pesewas: number): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });

export function formatDate(iso?: string): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

export function formatDateTime(iso?: string): string {
  return iso ? dateTimeFormatter.format(new Date(iso)) : "—";
}

/** Accra is UTC+0 year-round, so a YYYY-MM-DD day key is the UTC date. */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  return `${digits.slice(0, 3)}•••••${digits.slice(-2)}`;
}

export function maskEmail(email?: string): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 1)}•••@${domain}`;
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  abandoned: "Abandoned",
  refund_pending: "Refund pending",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
};

export const FULFILMENT_LABELS: Record<FulfilmentStatus, string> = {
  new: "New",
  picking: "Picking",
  packed: "Packed",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  exception: "Exception",
};

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
