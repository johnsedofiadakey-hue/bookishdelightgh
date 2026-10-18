import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon, WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishSocials, bookishWhatsAppUrl } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact | Bookish Delight GH",
  description: "Reach Bookish Delight GH on WhatsApp or find our Kumasi business address.",
};

export default function ContactPage() {
  return <main className="contact-page shell" id="top">
    <div className="contact-intro" data-reveal><p className="eyebrow">Hello from Kumasi</p><h1>Ask us anything.</h1><p>Looking for a book, or have a question? Send us a message on WhatsApp.</p><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> Chat on WhatsApp <ArrowUpRightIcon/></a></div>
    <div className="contact-card" data-reveal><div className="contact-logo"><Image src={bookishBrand.logoPath} alt="Bookish Delight GH logo: an open book within colourful circular shapes, with the tagline Nurturing Young Minds One Book At A Time" width={1024} height={1024}/></div><div className="contact-details"><p className="eyebrow">Our details</p><dl><div><dt>WhatsApp</dt><dd><a href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">{bookishBrand.whatsappDisplay}</a></dd></div>{bookishSocials.map((social) => <div key={social.name}><dt>{social.name}</dt><dd><a href={social.url} target="_blank" rel="noopener noreferrer">{social.handle}</a></dd></div>)}<div><dt>Business address</dt><dd>{bookishBrand.streetAddress}</dd></div><div><dt>GhanaPost GPS</dt><dd>{bookishBrand.gpsAddress}</dd></div><div><dt>Postal address</dt><dd>{bookishBrand.postalAddress}</dd></div></dl><p className="contact-note">Please message us before you visit. You can’t order online yet.</p><Link href="/shop">Browse books <ArrowUpRightIcon/></Link></div></div>
  </main>;
}
