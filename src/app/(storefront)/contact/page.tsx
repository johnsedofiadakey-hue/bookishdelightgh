import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ContactIconLinks, LocationLink } from "@/components/storefront/contact-links";
import { SocialLinks } from "@/components/storefront/social-links";
import { bookishBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact | Bookish Delight GH",
  description: "Reach Bookish Delight GH by email or WhatsApp, or find our Kumasi business address.",
};

export default function ContactPage() {
  return <main className="contact-page shell" id="top">
    <div className="contact-intro" data-reveal><p className="eyebrow">Hello from Kumasi</p><h1>Ask us anything.</h1><p>Looking for a book, brand new or preloved, or have a question about Bookish Delight? Message us on WhatsApp or send an email.</p><div className="contact-actions"><ContactIconLinks className="contact-intro-links"/></div></div>
    <div className="contact-card" data-reveal>
      <div className="contact-logo"><Image src={bookishBrand.logoPath} alt="Bookish Delight GH logo: an open book within colourful circular shapes, with the tagline Nurturing Young Minds One Book At A Time" width={1024} height={1024}/></div>
      <div className="contact-details"><p className="eyebrow">Our details</p><dl>
        <div><dt>Contact us</dt><dd><ContactIconLinks/></dd></div>
        <div><dt>Follow us</dt><dd><SocialLinks/></dd></div>
        <div><dt>Business address</dt><dd className="address-with-map"><span>{bookishBrand.streetAddress}</span><LocationLink/></dd></div>
        <div><dt>GhanaPost GPS</dt><dd>{bookishBrand.gpsAddress}</dd></div>
        <div><dt>Postal address</dt><dd>{bookishBrand.postalAddress}</dd></div>
      </dl><p className="contact-note">Please contact us before visiting. Online ordering is not yet available in this preview.</p><Link href="/shop">Browse books ↗</Link></div>
    </div>
  </main>;
}
