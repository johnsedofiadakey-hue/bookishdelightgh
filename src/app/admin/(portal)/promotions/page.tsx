import { randomUUID } from "node:crypto";
import { ActionForm, Field } from "@/components/admin/action-form";
import { Badge, Callout, Card, EmptyState, Money, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDate, pesewasToDecimal } from "@/lib/admin/format";
import { listCategories } from "@/lib/admin/ops/catalogue";
import { listPromotions, promotionState } from "@/lib/admin/ops/promotions";
import { getAdminStore } from "@/lib/admin/store";
import type { Category, Promotion } from "@/lib/admin/types";
import { savePromotionAction } from "./actions";

export const metadata = { title: "Promotions" };

const STATE_TONE = { active: "green", scheduled: "blue", expired: "plain", paused: "amber", exhausted: "plain" } as const;

function PromotionFields({ promotion, categories }: { promotion?: Promotion; categories: Category[] }) {
  return (
    <div className="adm-fields adm-fields-3">
      <Field name="code" label="Code" required hint="Letters and numbers, e.g. READMORE10"><input type="text" name="code" defaultValue={promotion?.code} required style={{ textTransform: "uppercase" }} /></Field>
      <Field name="kind" label="Discount type" required>
        <select name="kind" defaultValue={promotion?.kind ?? "percent"}>
          <option value="percent">Percent off books</option>
          <option value="fixed">Fixed GH₵ off</option>
        </select>
      </Field>
      <Field name="value" label="Value" required hint="Percent (e.g. 10) or GH₵ amount (e.g. 20.00)">
        <input type="text" name="value" inputMode="decimal" defaultValue={promotion ? (promotion.kind === "percent" ? String(promotion.value / 100) : pesewasToDecimal(promotion.value)) : ""} required />
      </Field>
      <Field name="minOrderPesewas" label="Minimum order (GH₵)"><input type="text" name="minOrder" inputMode="decimal" defaultValue={promotion?.minOrderPesewas ? pesewasToDecimal(promotion.minOrderPesewas) : ""} /></Field>
      <Field name="usageLimit" label="Total uses" hint="Blank = unlimited"><input type="number" name="usageLimit" min={1} defaultValue={promotion?.usageLimit} /></Field>
      <Field name="perCustomerLimit" label="Uses per customer" hint="Blank = unlimited"><input type="number" name="perCustomerLimit" min={1} defaultValue={promotion?.perCustomerLimit} /></Field>
      <Field name="startsAt" label="Starts"><input type="date" name="startsAt" defaultValue={(promotion?.startsAt ?? new Date().toISOString()).slice(0, 10)} /></Field>
      <Field name="endsAt" label="Ends" hint="Optional"><input type="date" name="endsAt" defaultValue={promotion?.endsAt?.slice(0, 10)} /></Field>
      <div className="adm-field" style={{ alignSelf: "end" }}>
        <label className="adm-check"><input type="checkbox" name="active" defaultChecked={promotion?.active ?? true} /> Active</label>
      </div>
      <fieldset className="wide">
        <legend className="adm-field"><span>Eligible categories (none ticked = all books)</span></legend>
        <div className="adm-checks">
          {categories.map((category) => (
            <label className="adm-check" key={category.id}><input type="checkbox" name="eligibleCategoryIds" value={category.id} defaultChecked={promotion?.eligibleCategoryIds.includes(category.id)} /> {category.name}</label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default async function PromotionsPage() {
  const access = await pageAccess("promotions.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const store = getAdminStore();
  const [promotions, categories] = await Promise.all([listPromotions(store, ctx), listCategories(store)]);
  const editable = can(ctx, "promotions.edit");

  return (
    <>
      <PageHeader eyebrow="Shelf" title="Promotions" lede="Define discount codes here. Checkout validates eligibility, limits and dates on the server; the admin never applies a discount to a paid order." />
      <div style={{ marginBottom: 16 }}>
        <Callout tone="info">Discounts apply to book subtotal only, never to delivery. Usage counts are maintained by checkout and are read-only here.</Callout>
      </div>
      <Card title="Codes">
        {promotions.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table" data-stack>
              <thead><tr><th>Code</th><th>Discount</th><th>Window</th><th>Usage</th><th>State</th></tr></thead>
              <tbody>
                {promotions.map((promotion) => {
                  const state = promotionState(promotion);
                  return (
                    <tr key={promotion.id}>
                      <td className="primary adm-mono" data-label="Code"><strong>{promotion.code}</strong></td>
                      <td data-label="Discount">{promotion.kind === "percent" ? `${promotion.value / 100}% off` : <><Money pesewas={promotion.value} /> off</>}{promotion.minOrderPesewas ? <span className="sub">min <Money pesewas={promotion.minOrderPesewas} /></span> : null}</td>
                      <td data-label="Window">{formatDate(promotion.startsAt)} → {promotion.endsAt ? formatDate(promotion.endsAt) : "no end"}</td>
                      <td data-label="Usage">{promotion.usedCount}{promotion.usageLimit ? ` / ${promotion.usageLimit}` : ""}</td>
                      <td data-label="State"><Badge tone={STATE_TONE[state]}>{state}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No promotions yet" art="%">Create a code for a reading season, a school partnership or a launch.</EmptyState>
        )}
      </Card>
      {editable ? (
        <>
          <Card title="New promotion">
            <ActionForm action={savePromotionAction} idempotencyKey={randomUUID()} submitLabel="Create promotion" resetOnSuccess>
              <input type="hidden" name="promotionId" value="" />
              <PromotionFields categories={categories} />
            </ActionForm>
          </Card>
          {promotions.length ? (
            <Card title="Edit promotions">
              {promotions.map((promotion) => (
                <details key={promotion.id} style={{ marginBottom: 10 }}>
                  <summary className="adm-link" style={{ cursor: "pointer" }}>{promotion.code}</summary>
                  <div style={{ paddingTop: 12 }}>
                    <ActionForm action={savePromotionAction} idempotencyKey={randomUUID()} submitLabel="Save promotion">
                      <input type="hidden" name="promotionId" value={promotion.id} />
                      <PromotionFields promotion={promotion} categories={categories} />
                    </ActionForm>
                  </div>
                </details>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}
