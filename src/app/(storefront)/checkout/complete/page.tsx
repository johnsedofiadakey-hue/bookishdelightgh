import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/storefront/icons";
import { getAdminStore } from "@/lib/admin/store";
import { bookishWhatsAppUrl } from "@/lib/brand";
import { applyPaystackOutcome, type ConfirmResult } from "@/lib/commerce/checkout";
import { verifyTransaction } from "@/lib/commerce/paystack";
import { ClearCart } from "./clear-cart";

export const metadata: Metadata = { title: "Order status | Bookish Delight GH", robots: { index: false } };

async function confirm(reference: string): Promise<ConfirmResult | { state: "error" }> {
  try {
    const outcome = await verifyTransaction(reference);
    return await applyPaystackOutcome(getAdminStore(), outcome, "callback");
  } catch (error) {
    console.error("[checkout complete]", error);
    return { state: "error" };
  }
}

export default async function CheckoutCompletePage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const params = await searchParams;
  const reference = String(params.reference ?? params.trxref ?? "").slice(0, 80);
  const result = /^BD-[A-Z0-9-]{6,30}$/.test(reference) ? await confirm(reference) : { state: "unknown" as const };

  if (result.state === "paid") {
    return <main className="interior-page shell checkout-result"><ClearCart/>
      <p className="eyebrow">Thank you!</p><h1>Your order is confirmed.</h1>
      <p className="checkout-result-ref">Order number <strong>{result.ref}</strong></p>
      <p>We’ve received your payment and will start preparing your order. We’ll send SMS updates to the phone number you gave us. Keep your order number to track it.</p>
      <div className="checkout-result-actions"><Link className="button button-dark" href="/track">Track your order ↗</Link><Link className="text-link" href="/shop">Continue shopping</Link></div>
    </main>;
  }
  if (result.state === "failed") {
    return <main className="interior-page shell checkout-result"><p className="eyebrow">Payment not completed</p><h1>Your payment didn’t go through.</h1><p>No money was taken for order <strong>{result.ref}</strong>, and the items have been put back on the shelf. Your bag is still saved, so you can try again.</p><div className="checkout-result-actions"><Link className="button button-dark" href="/checkout">Try again ↗</Link><a className="text-link" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">Ask us on WhatsApp</a></div></main>;
  }
  if (result.state === "pending") {
    return <main className="interior-page shell checkout-result"><p className="eyebrow">Waiting for payment</p><h1>We haven’t received your payment yet.</h1><p>If you approved a Mobile Money prompt, it can take a minute to confirm. Refresh this page shortly. If you cancelled, your items are held for a short time and your bag is still saved.</p><div className="checkout-result-actions"><Link className="button button-dark" href={`/checkout/complete?reference=${encodeURIComponent(reference)}`}>Check again ↻</Link><Link className="text-link" href="/checkout">Back to checkout</Link></div></main>;
  }
  return <main className="interior-page shell checkout-result"><p className="eyebrow">Order status</p><h1>We couldn’t confirm this payment.</h1><p>If you were charged, don’t worry. Send us the payment reference from your Paystack receipt or Mobile Money SMS and we’ll sort it out.</p><div className="checkout-result-actions"><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> Message us</a><Link className="text-link" href="/track">Track an order</Link></div></main>;
}
