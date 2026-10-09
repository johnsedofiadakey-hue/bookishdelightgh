"use server";

import { headers } from "next/headers";
import { getAdminStore } from "@/lib/admin/store";
import { trackOrder, type TrackedOrder } from "@/lib/storefront/order-tracking";

export type TrackState =
  | { status: "idle" }
  | { status: "error"; message: string; ref?: string }
  | { status: "found"; order: TrackedOrder };

const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 10;
type AttemptGlobal = typeof globalThis & { __bookishTrackAttempts?: Map<string, number[]> };

/** Best-effort, per-instance limit on lookups from one address. */
function allowAttempt(key: string): boolean {
  const holder = globalThis as AttemptGlobal;
  const attempts = (holder.__bookishTrackAttempts ??= new Map<string, number[]>());
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) attempts.clear();
  return true;
}

export async function trackOrderAction(_state: TrackState, form: FormData): Promise<TrackState> {
  const ref = String(form.get("ref") ?? "").slice(0, 40);
  const phone = String(form.get("phone") ?? "").slice(0, 40);
  const requestHeaders = await headers();
  const client = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowAttempt(client)) return { status: "error", message: "Too many attempts. Please wait a few minutes, or message us on WhatsApp.", ref };
  try {
    const result = await trackOrder(getAdminStore(), ref, phone);
    if (result.ok) return { status: "found", order: result.order };
    return {
      status: "error",
      ref,
      message: result.reason === "invalid"
        ? "Enter your order number (it starts with BD-) and a Ghana phone number."
        : "We couldn’t find an order with that number and phone. Check both and try again, or message us on WhatsApp.",
    };
  } catch (error) {
    console.error("[track order]", error);
    return { status: "error", message: "Order tracking is unavailable right now. Please message us on WhatsApp.", ref };
  }
}
