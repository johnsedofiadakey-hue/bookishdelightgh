import { randomUUID } from "node:crypto";
import Link from "next/link";
import { EmptyState, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { rateIsLive } from "@/lib/admin/ops/delivery";
import { listInventory } from "@/lib/admin/ops/inventory";
import { getAdminStore } from "@/lib/admin/store";
import { manualSaleAction } from "../actions";
import { ManualSaleForm } from "./manual-sale-form";

export const metadata = { title: "Add a sale" };

export default async function ManualSalePage() {
  const access = await pageAccess("orders.manual_sale");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const store = getAdminStore();
  const [inventory, variants, rates] = await Promise.all([listInventory(store, ctx), store.query("bookVariants"), store.query("deliveryRates", { where: [["active", "==", true]] })]);
  const weightBySku = new Map(variants.map((variant) => [variant.sku, variant.weightGrams]));
  const sellable = inventory.filter((row) => row.active && row.available > 0 && row.bookStatus !== "archived");
  const now = new Date().toISOString();

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/orders", label: "Orders" }]}
        eyebrow="Instagram · WhatsApp · phone · walk-in"
        title="Add a sale made outside the website"
        lede="It uses the same stock and order list as the website, marked “Not on website”. It only counts as paid once someone approves the proof of payment."
      />
      {sellable.length ? (
        <ManualSaleForm
          action={manualSaleAction}
          idempotencyKey={randomUUID()}
          canApprove={can(ctx, "payments.approve_manual")}
          variants={sellable.map((row) => ({ sku: row.sku, label: `${row.title} · ${row.format} (${row.sku})`, pricePesewas: row.pricePesewas, weightGrams: weightBySku.get(row.sku) ?? 0, available: row.available }))}
          rates={rates.filter((rate) => rateIsLive(rate, now) && rate.serviceLevel !== "pickup").map((rate) => ({ id: rate.id, name: rate.name, region: rate.region, cities: rate.cities, pricePesewas: rate.pricePesewas, minWeightGrams: rate.minWeightGrams, maxWeightGrams: rate.maxWeightGrams, minOrderPesewas: rate.minOrderPesewas, estimate: rate.estimate }))}
        />
      ) : (
        <EmptyState title="Nothing is available to sell" icon="inventory" action={<Link className="adm-btn" href="/admin/inventory">Go to stock</Link>}>
          To add a sale, at least one product option needs stock you can sell.
        </EmptyState>
      )}
    </>
  );
}
