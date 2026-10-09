"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { idempotencyKey, runAction, text } from "@/lib/admin/actions";
import { retryNotification } from "@/lib/admin/ops/notifications";

export async function retryNotificationAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("notifications.retry", async ({ store, ctx }) => {
    const { replayed } = await retryNotification(store, ctx, text(form, "notificationId"), idempotencyKey(form));
    return { message: replayed ? "Already re-queued." : "Re-queued. The SMS worker will send it once; the event key prevents duplicates." };
  });
}
