import { bookishBrand } from "@/lib/brand";

/**
 * Business facts used by the legal and policy pages.
 *
 * `null` means the owner has not confirmed the value yet. The pages render a
 * visible "To confirm" marker in its place, so nothing unconfirmed reads as a
 * promise. Fill these in, then have a Ghanaian lawyer review the final text
 * before online ordering opens.
 */
export const legalFacts = {
  /** Date the current policy text took effect (ISO date). */
  effectiveDate: "2026-10-09",
  /** Registered business name as on the Registrar-General / ORC certificate. */
  registeredName: null as string | null,
  /** Business registration number. */
  registrationNumber: null as string | null,
  /** Data Protection Commission registration number, once registered. */
  dataProtectionRegistration: null as string | null,
  /** Email for privacy and data requests. */
  contactEmail: null as string | null,
  /** Days after delivery within which a return can be requested. */
  returnWindowDays: null as number | null,
  /** Working days to issue a refund after an approved return. */
  refundProcessingDays: null as number | null,
  /** Whether customers can collect orders in Kumasi. */
  pickupAvailable: null as boolean | null,
  /** Opening hours for pickup, if offered. */
  pickupHours: null as string | null,
  whatsappDisplay: bookishBrand.whatsappDisplay,
  streetAddress: bookishBrand.streetAddress,
  gpsAddress: bookishBrand.gpsAddress,
  postalAddress: bookishBrand.postalAddress,
} as const;

export const legalPages = [
  { href: "/terms", title: "Terms & Conditions" },
  { href: "/privacy", title: "Privacy Policy" },
  { href: "/returns", title: "Returns & Refunds" },
  { href: "/delivery", title: "Delivery Policy" },
  { href: "/safety", title: "Product Safety" },
] as const;

export function formatLegalDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Accra" }).format(new Date(`${isoDate}T12:00:00Z`));
}
