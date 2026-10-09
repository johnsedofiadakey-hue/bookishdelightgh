import type { AdminDataStore } from "@/lib/admin/store/types";
import { applyPaystackOutcome, expiredPendingOrders, releaseExpiredOrder } from "@/lib/commerce/checkout";
import { paystackConfigured, verifyTransaction } from "@/lib/commerce/paystack";

/**
 * Release stock held by website orders that were not paid in time. Before
 * releasing, ask Paystack once whether the payment actually went through, so a
 * slow webhook never cancels a paid order. Best effort: errors are logged and
 * the order is retried on the next sweep.
 */
export async function sweepExpiredReservations(store: AdminDataStore): Promise<number> {
  let released = 0;
  for (const order of await expiredPendingOrders(store)) {
    try {
      if (order.paystackReference && paystackConfigured()) {
        const outcome = await verifyTransaction(order.paystackReference).catch(() => null);
        if (outcome && (outcome.status === "success" || outcome.status === "failed" || outcome.status === "reversed")) {
          await applyPaystackOutcome(store, outcome, "verify_api");
          continue;
        }
      }
      if (await releaseExpiredOrder(store, order.id)) released += 1;
    } catch (error) {
      console.error("[reservation sweep]", order.id, error);
    }
  }
  return released;
}
