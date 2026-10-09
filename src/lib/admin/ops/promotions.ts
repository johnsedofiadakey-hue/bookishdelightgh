import { pick, recordAudit, stripUndefined } from "@/lib/admin/audit";
import { assertPermission, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { newId, nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import type { AdminDataStore } from "@/lib/admin/store/types";
import type { Promotion } from "@/lib/admin/types";

/**
 * Promotion definitions. The admin only stores the rules; final eligibility
 * and discount maths happen server-side in shared commerce at checkout
 * (request R3). `usedCount` is owned by commerce and never edited here.
 */

export interface PromotionInput {
  code: string;
  kind: Promotion["kind"];
  /** Pesewas for fixed; basis points for percent. */
  value: number;
  minOrderPesewas: number;
  eligibleCategoryIds: string[];
  usageLimit?: number;
  perCustomerLimit?: number;
  startsAt: string;
  endsAt?: string;
  active: boolean;
}

function validate(input: PromotionInput): PromotionInput {
  const errors: Record<string, string> = {};
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) errors.code = "3–20 letters or numbers, no spaces.";
  if (input.kind === "percent" && (!Number.isInteger(input.value) || input.value < 100 || input.value > 9000)) errors.value = "Percent discounts must be 1%–90%.";
  if (input.kind === "fixed" && (!Number.isSafeInteger(input.value) || input.value <= 0)) errors.value = "Enter the discount amount.";
  if (input.kind === "fixed" && input.minOrderPesewas > 0 && input.value >= input.minOrderPesewas) errors.value = "A fixed discount must be below the minimum order value.";
  if (!Number.isSafeInteger(input.minOrderPesewas) || input.minOrderPesewas < 0) errors.minOrderPesewas = "0 or more.";
  if (input.usageLimit !== undefined && (!Number.isInteger(input.usageLimit) || input.usageLimit < 1)) errors.usageLimit = "1 or more, or leave blank.";
  if (input.perCustomerLimit !== undefined && (!Number.isInteger(input.perCustomerLimit) || input.perCustomerLimit < 1)) errors.perCustomerLimit = "1 or more, or leave blank.";
  if (Number.isNaN(Date.parse(input.startsAt))) errors.startsAt = "Choose a start date.";
  if (input.endsAt && (Number.isNaN(Date.parse(input.endsAt)) || input.endsAt <= input.startsAt)) errors.endsAt = "End must be after start.";
  if (Object.keys(errors).length) throw new AdminError("invalid", "Please fix the highlighted fields.", errors);
  return { ...input, code };
}

export async function savePromotion(store: AdminDataStore, ctx: StaffContext, promotionId: string | null, input: PromotionInput, idempotencyKey: string) {
  assertPermission(ctx, "promotions.edit");
  const value = validate(input);
  return runIdempotent(store, ctx, "promotions.save", idempotencyKey, async (tx) => {
    const clash = await tx.query("promotions", { where: [["code", "==", value.code]] });
    if (clash.some((promotion) => promotion.id !== promotionId)) throw new AdminError("conflict", "Another promotion uses this code.", { code: "Already in use" });
    const existing = promotionId ? await tx.get("promotions", promotionId) : null;
    if (promotionId && !existing) throw new AdminError("not_found", "Promotion not found.");
    const at = nowIso();
    const promotion: Promotion = stripUndefined({
      id: existing?.id ?? newId("promo"),
      ...value,
      usedCount: existing?.usedCount ?? 0,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
      updatedBy: ctx.uid,
    });
    if (existing) tx.set("promotions", promotion.id, promotion);
    else tx.create("promotions", promotion.id, promotion);
    recordAudit(tx, ctx, {
      action: existing ? "promotions.update" : "promotions.create",
      entityType: "promotion",
      entityId: promotion.id,
      summary: `${existing ? "Updated" : "Created"} promotion ${promotion.code}`,
      before: pick(existing, ["kind", "value", "active", "usageLimit", "endsAt"]),
      after: pick(promotion, ["kind", "value", "active", "usageLimit", "endsAt"]),
    });
    return { promotionId: promotion.id };
  });
}

export async function listPromotions(store: AdminDataStore, ctx: StaffContext): Promise<Promotion[]> {
  assertPermission(ctx, "promotions.view");
  return store.query("promotions", { orderBy: { field: "updatedAt", direction: "desc" } });
}

export function promotionState(promotion: Promotion, at = nowIso()): "active" | "scheduled" | "expired" | "paused" | "exhausted" {
  if (!promotion.active) return "paused";
  if (promotion.usageLimit !== undefined && promotion.usedCount >= promotion.usageLimit) return "exhausted";
  if (promotion.startsAt > at) return "scheduled";
  if (promotion.endsAt && promotion.endsAt <= at) return "expired";
  return "active";
}
