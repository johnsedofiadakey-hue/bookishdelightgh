import { pick, recordAudit, stripUndefined } from "@/lib/admin/audit";
import { assertPermission, type StaffContext } from "@/lib/admin/context";
import { AdminError } from "@/lib/admin/errors";
import { newId, nowIso } from "@/lib/admin/ids";
import { runIdempotent } from "@/lib/admin/idempotency";
import type { AdminDataStore } from "@/lib/admin/store/types";
import type { DeliveryRate } from "@/lib/admin/types";
import { GHANA_REGIONS, isGhanaRegion, splitList } from "@/lib/admin/validation";

/**
 * Nationwide delivery rate table. Rates are immutable once created: an edit
 * creates the next version and deactivates the old one, so orders keep
 * pointing at the exact `rateId`/`rateVersion` they were quoted.
 *
 * `quoteDelivery` is the admin preview of the matching rule. Checkout must use
 * the shared commerce quote (request R3), which should apply the same rule.
 */

export interface RateInput {
  name: string;
  region: string;
  cities: string[];
  serviceLevel: DeliveryRate["serviceLevel"];
  minWeightGrams: number;
  maxWeightGrams: number;
  minOrderPesewas: number;
  pricePesewas: number;
  estimate: string;
  activeFrom: string;
  activeTo?: string;
}

function validateRate(input: RateInput): RateInput {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Name the rate (e.g. “Accra metro standard”).";
  if (!isGhanaRegion(input.region)) errors.region = "Choose a Ghana region.";
  if (!["standard", "express", "pickup"].includes(input.serviceLevel)) errors.serviceLevel = "Choose a service level.";
  if (!Number.isInteger(input.minWeightGrams) || input.minWeightGrams < 0) errors.minWeightGrams = "0 or more grams.";
  if (!Number.isInteger(input.maxWeightGrams) || input.maxWeightGrams <= input.minWeightGrams) errors.maxWeightGrams = "Must be above the minimum weight.";
  if (!Number.isSafeInteger(input.minOrderPesewas) || input.minOrderPesewas < 0) errors.minOrderPesewas = "0 or more.";
  if (!Number.isSafeInteger(input.pricePesewas) || input.pricePesewas < 0 || input.pricePesewas > 500_000) errors.pricePesewas = "GH₵0–5,000.";
  if (!input.estimate.trim()) errors.estimate = "Give a delivery estimate (e.g. “1–2 working days”).";
  if (Number.isNaN(Date.parse(input.activeFrom))) errors.activeFrom = "Choose a start date.";
  if (input.activeTo && (Number.isNaN(Date.parse(input.activeTo)) || input.activeTo <= input.activeFrom)) errors.activeTo = "End must be after start.";
  if (/same[-\s]?day/i.test(input.estimate) && input.cities.length === 0) errors.estimate = "Same-day promises must be limited to named cities, not a whole region.";
  if (Object.keys(errors).length) throw new AdminError("invalid", "Please fix the highlighted fields.", errors);
  return { ...input, name: input.name.trim(), estimate: input.estimate.trim(), cities: splitList(input.cities.join(",")).map((city) => city.trim()) };
}

export async function createRate(store: AdminDataStore, ctx: StaffContext, input: RateInput, idempotencyKey: string) {
  assertPermission(ctx, "delivery.edit");
  const value = validateRate(input);
  return runIdempotent(store, ctx, "delivery.create", idempotencyKey, async (tx) => {
    const id = newId("rate");
    const rate: DeliveryRate = stripUndefined({ id, familyId: id, version: 1, ...value, active: true, createdAt: nowIso(), createdBy: ctx.uid });
    tx.create("deliveryRates", id, rate);
    recordAudit(tx, ctx, { action: "delivery.rate.create", entityType: "deliveryRate", entityId: id, summary: `Created rate ${rate.name} v1 (${rate.region})`, after: pick(rate, ["pricePesewas", "region", "cities", "serviceLevel"]) });
    return { rateId: id };
  });
}

export async function reviseRate(store: AdminDataStore, ctx: StaffContext, rateId: string, input: RateInput, idempotencyKey: string) {
  assertPermission(ctx, "delivery.edit");
  const value = validateRate(input);
  return runIdempotent(store, ctx, "delivery.revise", idempotencyKey, async (tx) => {
    const current = await tx.get("deliveryRates", rateId);
    if (!current) throw new AdminError("not_found", "Rate not found.");
    if (!current.active || current.supersededBy) throw new AdminError("conflict", "This rate has already been replaced. Edit the latest version.");
    const id = newId("rate");
    const at = nowIso();
    const next: DeliveryRate = stripUndefined({ id, familyId: current.familyId, version: current.version + 1, ...value, active: true, createdAt: at, createdBy: ctx.uid });
    tx.create("deliveryRates", id, next);
    tx.update("deliveryRates", current.id, { active: false, supersededBy: id, activeTo: at });
    recordAudit(tx, ctx, {
      action: "delivery.rate.revise",
      entityType: "deliveryRate",
      entityId: current.familyId,
      summary: `${current.name}: v${current.version} → v${next.version}`,
      before: pick(current, ["pricePesewas", "cities", "minWeightGrams", "maxWeightGrams", "estimate"]),
      after: pick(next, ["pricePesewas", "cities", "minWeightGrams", "maxWeightGrams", "estimate"]),
    });
    return { rateId: id };
  });
}

export async function deactivateRate(store: AdminDataStore, ctx: StaffContext, rateId: string, idempotencyKey: string) {
  assertPermission(ctx, "delivery.edit");
  return runIdempotent(store, ctx, "delivery.deactivate", idempotencyKey, async (tx) => {
    const current = await tx.get("deliveryRates", rateId);
    if (!current) throw new AdminError("not_found", "Rate not found.");
    if (!current.active) return { rateId };
    tx.update("deliveryRates", rateId, { active: false, activeTo: nowIso() });
    recordAudit(tx, ctx, { action: "delivery.rate.deactivate", entityType: "deliveryRate", entityId: current.familyId, summary: `Deactivated ${current.name} v${current.version}` });
    return { rateId };
  });
}

export async function listRates(store: AdminDataStore, ctx: StaffContext, includeHistory = false): Promise<DeliveryRate[]> {
  assertPermission(ctx, "delivery.view");
  const rates = await store.query("deliveryRates");
  return rates
    .filter((rate) => includeHistory || rate.active)
    .sort((left, right) => left.region.localeCompare(right.region) || left.name.localeCompare(right.name) || right.version - left.version);
}

export interface QuoteRequest {
  region: string;
  city: string;
  weightGrams: number;
  orderPesewas: number;
  at?: string;
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ");
}

export function rateIsLive(rate: DeliveryRate, at: string): boolean {
  return rate.active && rate.activeFrom <= at && (!rate.activeTo || rate.activeTo > at);
}

/**
 * Matching rule: live rate, same region, weight within [min, max], order value
 * at least `minOrderPesewas`. A city-specific rate beats a region-wide one.
 * Returns the cheapest option per service level.
 */
export function quoteDelivery(rates: DeliveryRate[], request: QuoteRequest): DeliveryRate[] {
  const at = request.at ?? nowIso();
  const city = normalizeCity(request.city);
  const candidates = rates.filter(
    (rate) =>
      rateIsLive(rate, at) &&
      rate.region === request.region &&
      request.weightGrams >= rate.minWeightGrams &&
      request.weightGrams <= rate.maxWeightGrams &&
      request.orderPesewas >= rate.minOrderPesewas &&
      (rate.cities.length === 0 || rate.cities.some((name) => normalizeCity(name) === city)),
  );
  const best = new Map<string, DeliveryRate>();
  for (const rate of candidates) {
    const current = best.get(rate.serviceLevel);
    const specific = rate.cities.length > 0;
    const currentSpecific = current ? current.cities.length > 0 : false;
    if (!current || (specific && !currentSpecific) || (specific === currentSpecific && rate.pricePesewas < current.pricePesewas)) best.set(rate.serviceLevel, rate);
  }
  return [...best.values()].sort((left, right) => left.pricePesewas - right.pricePesewas);
}

/** Regions with no live region-wide standard/express rate for a 1 kg parcel. */
export function coverageGaps(rates: DeliveryRate[], at = nowIso()): { region: string; cityOnly: string[] }[] {
  return GHANA_REGIONS.flatMap((region) => {
    const live = rates.filter((rate) => rate.region === region && rateIsLive(rate, at) && rate.serviceLevel !== "pickup");
    const regionWide = live.some((rate) => rate.cities.length === 0 && rate.minWeightGrams <= 1000 && rate.maxWeightGrams >= 1000);
    if (regionWide) return [];
    return [{ region, cityOnly: [...new Set(live.flatMap((rate) => rate.cities))] }];
  });
}

export const SAMPLE_DESTINATIONS: { label: string; region: string; city: string }[] = [
  { label: "Osu, Accra", region: "Greater Accra", city: "Accra" },
  { label: "Tema", region: "Greater Accra", city: "Tema" },
  { label: "Kumasi", region: "Ashanti", city: "Kumasi" },
  { label: "Cape Coast", region: "Central", city: "Cape Coast" },
  { label: "Takoradi", region: "Western", city: "Takoradi" },
  { label: "Ho", region: "Volta", city: "Ho" },
  { label: "Tamale", region: "Northern", city: "Tamale" },
  { label: "Bolgatanga", region: "Upper East", city: "Bolgatanga" },
  { label: "Wa", region: "Upper West", city: "Wa" },
  { label: "Sunyani", region: "Bono", city: "Sunyani" },
];
