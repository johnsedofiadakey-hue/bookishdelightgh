import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact | Bookish Delight GH",
  description: "Reach Bookish Delight GH on WhatsApp or find our Kumasi business address.",
};

export default function ContactPage() {
  return <main className="contact-page shell" id="top">
    <div className="contact-intro" data-reveal><p className="eyebrow">Hello from Kumasi</p><h1>Ask us anything.</h1><p>Looking for a book, puzzle or educational game, or have a question about Bookish Delight? Send us a message on WhatsApp.</p><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> Chat on WhatsApp <span aria-hidden="true">↗</span></a></div>
    <div className="contact-card" data-reveal><div className="contact-logo"><Image src={bookishBrand.logoPath} alt="Bookish Delight GH logo: an open book within colourful circular shapes, with the tagline Nurturing Young Minds One Book At A Time" width={1024} height={1024}/></div><div className="contact-details"><p className="eyebrow">Our details</p><dl><div><dt>WhatsApp</dt><dd><a href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">{bookishBrand.whatsappDisplay}</a></dd></div><div><dt>Business address</dt><dd>{bookishBrand.streetAddress}</dd></div><div><dt>GhanaPost GPS</dt><dd>{bookishBrand.gpsAddress}</dd></div><div><dt>Postal address</dt><dd>{bookishBrand.postalAddress}</dd></div></dl><p className="contact-note">Please message us before visiting. Online ordering is not yet available in this preview.</p><Link href="/shop">Browse books ↗</Link></div></div>
  </main>;
}
