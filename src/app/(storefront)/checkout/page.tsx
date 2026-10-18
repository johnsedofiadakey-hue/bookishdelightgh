import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeftIcon, WhatsAppIcon } from "@/components/storefront/icons";
import { getAdminStore } from "@/lib/admin/store";
import { GHANA_REGIONS } from "@/lib/admin/validation";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";
import { paystackConfigured, paystackTestMode } from "@/lib/commerce/paystack";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout | Bookish Delight GH", robots: { index: false } };

async function checkoutOpen(): Promise<boolean> {
  try {
    return Boolean((await getAdminStore().get("siteSettings", "site"))?.checkoutEnabled);
  } catch (error) {
    console.error("[checkout settings]", error);
    return false;
  }
}

export default async function CheckoutPage() {
  await connection();
  const open = (await checkoutOpen()) && paystackConfigured();
  if (!open) {
    return <main className="interior-page shell"><p className="eyebrow">Checkout</p><div className="interior-heading"><div><h1>You can’t pay online right now.</h1><p>But you can still order from us on WhatsApp.</p></div></div><div className="empty-state"><h2>Order on WhatsApp</h2><p>Send us what’s in your bag and your town. We’ll tell you the price, the delivery cost and how to pay.</p><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a><p><Link href="/cart"><ArrowLeftIcon/> Back to your bag</Link></p></div></main>;
  }
  return <main className="interior-page shell checkout-page">
    <p className="eyebrow">Checkout</p>
    <div className="interior-heading"><div><h1>Checkout</h1><p>We deliver all over Ghana. Pay safely with Mobile Money or card through Paystack.</p></div></div>
    {paystackTestMode() ? <div className="checkout-test-banner" role="note"><strong>Test mode.</strong> Test mode: no real money is taken. Use Paystack’s test card or test Mobile Money number.</div> : null}
    <CheckoutForm regions={[...GHANA_REGIONS]}/>
  </main>;
}
