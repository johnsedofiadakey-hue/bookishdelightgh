"use server";

import { headers } from "next/headers";
import { isAdminError } from "@/lib/admin/errors";
import { getAdminStore } from "@/lib/admin/store";
import { cancelUnstartedOrder, createPendingOrder, quoteCheckout, type CheckoutInput, type CheckoutQuote } from "@/lib/commerce/checkout";
import { initializeTransaction, PaystackError, paystackConfigured } from "@/lib/commerce/paystack";
import { sweepExpiredReservations } from "@/lib/commerce/sweep";

export type QuoteResult = { ok: true; quote: CheckoutQuote } | { ok: false; message: string };

export async function quoteAction(input: { lines: unknown; region: string; city: string }): Promise<QuoteResult> {
  try {
    const quote = await quoteCheckout(getAdminStore(), { lines: input.lines, region: String(input.region ?? ""), city: String(input.city ?? "").slice(0, 120) });
    return { ok: true, quote };
  } catch (error) {
    console.error("[checkout quote]", error);
    return { ok: false, message: "We couldn’t check prices and delivery just now. Please try again." };
  }
}

export type StartResult =
  | { ok: true; authorizationUrl: string; ref: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

async function siteOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host")?.split(",")[0]?.trim() || list.get("host");
  if (host) {
    const proto = list.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "https://bookishdelightgh.com";
}

export async function startCheckoutAction(input: CheckoutInput): Promise<StartResult> {
  if (!paystackConfigured()) return { ok: false, message: "Online payment is not set up yet. Please message us on WhatsApp to order." };
  const store = getAdminStore();
  await sweepExpiredReservations(store).catch((error) => console.error("[checkout sweep]", error));

  let pending;
  try {
    pending = await createPendingOrder(store, input);
  } catch (error) {
    if (isAdminError(error)) return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
    console.error("[checkout create]", error);
    return { ok: false, message: "We couldn’t place your order just now. Please try again." };
  }

  try {
    const origin = await siteOrigin();
    const started = await initializeTransaction({
      email: pending.email,
      amountPesewas: pending.totalPesewas,
      reference: pending.paystackReference,
      callbackUrl: `${origin}/checkout/complete`,
      metadata: {
        order_id: pending.orderId,
        order_ref: pending.ref,
        custom_fields: [{ display_name: "Order", variable_name: "order_ref", value: pending.ref }],
      },
    });
    return { ok: true, authorizationUrl: started.authorizationUrl, ref: pending.ref };
  } catch (error) {
    const message = error instanceof PaystackError ? error.message : "Payment could not be started.";
    console.error("[checkout paystack init]", pending.ref, error);
    await cancelUnstartedOrder(store, pending.orderId, message).catch((cancelError) => console.error("[checkout cancel]", cancelError));
    return { ok: false, message: "We couldn’t connect to Paystack to start your payment. Nothing was charged. Please try again." };
  }
}
