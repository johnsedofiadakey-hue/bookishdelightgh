import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Paystack client (server only). The secret key never leaves the
 * server: it comes from PAYSTACK_SECRET_KEY (`.env.local` locally, Secret
 * Manager on App Hosting).
 *
 * Docs: https://paystack.com/docs/api/transaction/
 */

const API = "https://api.paystack.co";

export class PaystackError extends Error {}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(key)) throw new PaystackError("Paystack is not configured.");
  return key;
}

export function paystackConfigured(): boolean {
  return /^sk_(test|live)_[A-Za-z0-9]+$/.test(process.env.PAYSTACK_SECRET_KEY ?? "");
}

export function paystackTestMode(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_test_");
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof PaystackError) throw error;
    throw new PaystackError("Could not reach Paystack. Please try again.");
  }
  const body = (await response.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!response.ok || !body?.status || body.data === undefined) {
    throw new PaystackError(body?.message ? `Paystack: ${body.message}` : `Paystack request failed (${response.status}).`);
  }
  return body.data;
}

export interface InitializeInput {
  email: string;
  amountPesewas: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export async function initializeTransaction(input: InitializeInput): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const data = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountPesewas,
      currency: "GHS",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ["mobile_money", "card"],
      metadata: input.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference };
}

export interface VerifiedTransaction {
  reference: string;
  /** success | failed | abandoned | ongoing | pending | processing | queued | reversed */
  status: string;
  amountPesewas: number;
  currency: string;
  paidAt?: string;
  channel?: string;
}

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await call<{ reference: string; status: string; amount: number; currency: string; paid_at?: string | null; channel?: string }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return { reference: data.reference, status: data.status, amountPesewas: data.amount, currency: data.currency, paidAt: data.paid_at ?? undefined, channel: data.channel };
}

/** Checks the `x-paystack-signature` header (HMAC-SHA512 of the raw body). */
export function validWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !paystackConfigured()) return false;
  const expected = Buffer.from(createHmac("sha512", secretKey()).update(rawBody).digest("hex"));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
