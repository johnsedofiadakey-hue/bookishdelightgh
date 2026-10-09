import { NextResponse, type NextRequest } from "next/server";
import { getAdminStore } from "@/lib/admin/store";
import { applyPaystackOutcome } from "@/lib/commerce/checkout";
import { validWebhookSignature, verifyTransaction } from "@/lib/commerce/paystack";

/**
 * Paystack webhook. Set the URL in Paystack → Settings → API Keys & Webhooks:
 *   https://bookishdelightgh.com/api/paystack/webhook
 *
 * The signature is checked against the raw body. The event is never trusted on
 * its own: the transaction is re-verified with Paystack's API before any order
 * changes, and applying it is idempotent.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 100_000 || !validWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const reference = event.data?.reference;
  if ((event.event === "charge.success" || event.event === "charge.failed") && typeof reference === "string" && /^BD-[A-Z0-9-]{6,30}$/.test(reference)) {
    try {
      const outcome = await verifyTransaction(reference);
      await applyPaystackOutcome(getAdminStore(), outcome, "webhook");
    } catch (error) {
      console.error("[paystack webhook]", reference, error);
      // A non-2xx response makes Paystack retry later.
      return NextResponse.json({ error: "Temporary failure." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
