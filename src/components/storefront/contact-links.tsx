import { GmailIcon, LocationIcon, WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishMapSearchUrl, bookishWhatsAppUrl } from "@/lib/brand";

export function ContactIconLinks({ className = "" }: { className?: string }) {
  return <div className={`contact-icon-links ${className}`.trim()}>
    <a
      className="contact-icon-link contact-icon-whatsapp"
      href={bookishWhatsAppUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Message Bookish Delight GH on WhatsApp at ${bookishBrand.whatsappDisplay}`}
      title="WhatsApp"
    ><WhatsAppIcon/></a>
    <a
      className="contact-icon-link contact-icon-gmail"
      href={`mailto:${bookishBrand.email}`}
      aria-label={`Email Bookish Delight GH at ${bookishBrand.email}`}
      title="Email"
    ><GmailIcon/></a>
  </div>;
}

export function LocationLink() {
  return <a
    className="location-icon-link"
    href={bookishMapSearchUrl}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Search ${bookishBrand.streetAddress} on Google Maps`}
    title="Search address on Google Maps"
  ><LocationIcon/></a>;
}
