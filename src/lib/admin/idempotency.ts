import type { StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { derivedId, isValidIdempotencyKey, nowIso } from "@/lib/admin/ids";
import type { AdminDataStore, AdminTransaction } from "@/lib/admin/store/types";

export interface IdempotentResult<T> {
  result: T;
  /** True when this call was a retry/duplicate and nothing was written again. */
  replayed: boolean;
}

/**
 * Run `work` in a transaction guarded by an idempotency key.
 *
 * The key record is read first and created last in the same transaction, so a
 * duplicate click either sees the stored result (sequential retry) or fails
 * the commit (concurrent retry). `work` must follow reads-before-writes.
 */
export async function runIdempotent<T>(
  store: AdminDataStore,
  ctx: StaffContext,
  scope: string,
  key: string,
  work: (tx: AdminTransaction) => Promise<T>,
): Promise<IdempotentResult<T>> {
  if (!isValidIdempotencyKey(key)) throw new AdminError("invalid", "This form has expired. Reload the page and try again.");
  const id = derivedId("idem", scope, ctx.uid, key);
  try {
    return await store.runTransaction(async (tx) => {
      const prior = await tx.get("idempotencyKeys", id);
      if (prior) return { result: JSON.parse(prior.resultJson) as T, replayed: true };
      const result = await work(tx);
      tx.create("idempotencyKeys", id, { key: id, scope, actorUid: ctx.uid, resultJson: JSON.stringify(result ?? null), createdAt: nowIso() });
      return { result, replayed: false };
    });
  } catch (error) {
    // A concurrent duplicate lost the race on the key itself: return the winner's result.
    if (error instanceof AdminError && error.code === "conflict" && error.message.includes(id)) {
      const prior = await store.get("idempotencyKeys", id);
      if (prior) return { result: JSON.parse(prior.resultJson) as T, replayed: true };
    }
    throw error;
  }
}
