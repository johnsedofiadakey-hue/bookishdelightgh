import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";
import { TrackForm } from "./track-form";

export const metadata: Metadata = {
  title: "Track your order | Bookish Delight GH",
  description: "Check the status of your Bookish Delight GH order with your order number and phone number.",
  robots: { index: false },
};

export default function TrackPage() {
  return <main className="interior-page shell track-page" id="top">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span>Track your order</nav>
    <div className="track-layout">
      <div className="track-intro">
        <p className="eyebrow">Order tracking</p>
        <h1>Where’s my order?</h1>
        <p>Enter the order number from your SMS (it starts with <strong>BD-</strong>) and the phone number you ordered with.</p>
        <TrackForm/>
      </div>
      <aside className="track-help">
        <h2>Need help?</h2>
        <p>Can’t find your order number, or something doesn’t look right? Message us and we’ll check for you.</p>
        <a className="button button-light" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a>
        <p className="track-help-links"><Link href="/delivery">Delivery Policy</Link> · <Link href="/returns">Returns &amp; Refunds</Link></p>
      </aside>
    </div>
  </main>;
}
