import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ActionForm, Field } from "@/components/admin/action-form";
import { Badge, Callout, Card, EmptyState, Money, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDate, pesewasToDecimal } from "@/lib/admin/format";
import { coverageGaps, listRates, quoteDelivery, SAMPLE_DESTINATIONS } from "@/lib/admin/ops/delivery";
import { getAdminStore } from "@/lib/admin/store";
import type { DeliveryRate } from "@/lib/admin/types";
import { GHANA_REGIONS } from "@/lib/admin/validation";
import { deactivateRateAction, saveRateAction } from "./actions";

export const metadata = { title: "Delivery rates" };

function RateFields({ rate }: { rate?: DeliveryRate }) {
  return (
    <div className="adm-fields adm-fields-3">
      <Field name="name" label="Name" required><input type="text" name="name" defaultValue={rate?.name} required placeholder="Accra metro standard" /></Field>
      <Field name="region" label="Region" required>
        <select name="region" defaultValue={rate?.region ?? "Greater Accra"}>{GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}</select>
      </Field>
      <Field name="serviceLevel" label="Service level" required>
        <select name="serviceLevel" defaultValue={rate?.serviceLevel ?? "standard"}>
          <option value="standard">Standard</option>
          <option value="express">Express</option>
          <option value="pickup">Pickup point</option>
        </select>
      </Field>
      <Field name="cities" label="Cities / towns" wide hint="Comma separated. Leave blank to cover the whole region. City-specific rates win over region-wide ones.">
        <input type="text" name="cities" defaultValue={rate?.cities.join(", ")} placeholder="Accra, Tema, Madina" />
      </Field>
      <Field name="pricePesewas" label="Price (GH₵)" required><input type="text" name="price" inputMode="decimal" defaultValue={rate ? pesewasToDecimal(rate.pricePesewas) : ""} required /></Field>
      <Field name="minWeightGrams" label="Min weight (g)"><input type="number" name="minWeightGrams" min={0} defaultValue={rate?.minWeightGrams ?? 0} /></Field>
      <Field name="maxWeightGrams" label="Max weight (g)" required><input type="number" name="maxWeightGrams" min={1} defaultValue={rate?.maxWeightGrams ?? 5000} required /></Field>
      <Field name="minOrderPesewas" label="Min order (GH₵)" hint="Optional"><input type="text" name="minOrder" inputMode="decimal" defaultValue={rate?.minOrderPesewas ? pesewasToDecimal(rate.minOrderPesewas) : ""} /></Field>
      <Field name="estimate" label="Delivery estimate" required hint="Avoid promising same-day unless it is reliable."><input type="text" name="estimate" defaultValue={rate?.estimate} required placeholder="2–3 working days" /></Field>
      <Field name="activeFrom" label="Active from"><input type="date" name="activeFrom" defaultValue={(rate?.activeFrom ?? new Date().toISOString()).slice(0, 10)} /></Field>
      <Field name="activeTo" label="Active until" hint="Optional"><input type="date" name="activeTo" defaultValue={rate?.activeTo?.slice(0, 10)} /></Field>
    </div>
  );
}

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ region?: string; city?: string; weight?: string; order?: string; history?: string }> }) {
  const access = await pageAccess("delivery.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const params = await searchParams;
  const store = getAdminStore();
  const [rates, allRates] = await Promise.all([listRates(store, ctx, false), listRates(store, ctx, true)]);
  const gaps = coverageGaps(rates);
  const editable = can(ctx, "delivery.edit");
  const weight = Number(params.weight) || 500;
  const orderValue = Math.round((Number(params.order) || 100) * 100);
  const custom = params.region ? { label: `${params.city || "(any city)"}, ${params.region}`, region: params.region, city: params.city ?? "" } : null;
  const destinations = custom ? [custom, ...SAMPLE_DESTINATIONS] : SAMPLE_DESTINATIONS;
  const history = allRates.filter((rate) => !rate.active);

  return (
    <>
      <PageHeader eyebrow="Shelf" title="Delivery rates" lede="Nationwide rate table from one fulfilment origin. Checkout must show an exact price before payment; any edit creates a new version so past orders keep their quoted price." />

      {gaps.length ? (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="warn" title={`${gaps.length} of ${GHANA_REGIONS.length} regions have no region-wide rate for a 1 kg parcel`}>
            Checkout must block payment for unpriced destinations and offer a contact route.
            <p style={{ margin: "6px 0 0" }}>{gaps.map((gap) => `${gap.region}${gap.cityOnly.length ? ` (only ${gap.cityOnly.join(", ")})` : ""}`).join(" · ")}</p>
          </Callout>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}><Callout tone="ok">Every region has at least one live region-wide rate.</Callout></div>
      )}

      <div className="adm-grid adm-grid-main">
        <div className="adm-stack">
          <Card title="Live rates">
            {rates.length ? (
              <div className="adm-table-wrap">
                <table className="adm-table" data-stack>
                  <thead><tr><th>Rate</th><th>Coverage</th><th>Weight</th><th className="num">Price</th><th>Version</th></tr></thead>
                  <tbody>
                    {rates.map((rate) => (
                      <tr key={rate.id}>
                        <td className="primary" data-label="Rate"><strong>{rate.name}</strong><span className="sub">{rate.serviceLevel} · {rate.estimate}</span></td>
                        <td data-label="Coverage">{rate.region}<span className="sub">{rate.cities.length ? rate.cities.join(", ") : "Whole region"}</span></td>
                        <td className="nowrap" data-label="Weight">{rate.minWeightGrams}–{rate.maxWeightGrams} g{rate.minOrderPesewas ? <span className="sub">min order <Money pesewas={rate.minOrderPesewas} /></span> : null}</td>
                        <td className="num" data-label="Price"><Money pesewas={rate.pricePesewas} /></td>
                        <td data-label="Version"><Badge>v{rate.version}</Badge><span className="sub">from {formatDate(rate.activeFrom)}{rate.activeTo ? ` to ${formatDate(rate.activeTo)}` : ""}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No delivery rates yet" art="🚚">Add a rate for each region you deliver to. Without a rate, checkout cannot take payment for that destination.</EmptyState>
            )}
          </Card>

          {editable ? (
            <>
              <Card title="Add a rate">
                <ActionForm action={saveRateAction} idempotencyKey={randomUUID()} submitLabel="Create rate" resetOnSuccess>
                  <input type="hidden" name="rateId" value="" />
                  <RateFields />
                </ActionForm>
              </Card>
              {rates.length ? (
                <Card title="Edit a rate" description="Saving creates version n+1 and retires the current version.">
                  {rates.map((rate) => (
                    <details key={rate.id} style={{ marginBottom: 10 }}>
                      <summary className="adm-link" style={{ cursor: "pointer" }}>{rate.name} (v{rate.version})</summary>
                      <div className="adm-stack" style={{ paddingTop: 12 }}>
                        <ActionForm action={saveRateAction} idempotencyKey={randomUUID()} submitLabel="Save as new version">
                          <input type="hidden" name="rateId" value={rate.id} />
                          <RateFields rate={rate} />
                        </ActionForm>
                        <ActionForm action={deactivateRateAction} idempotencyKey={randomUUID()} submitLabel="Deactivate rate" variant="danger" confirm={`Stop offering “${rate.name}” at checkout?`}>
                          <input type="hidden" name="rateId" value={rate.id} />
                        </ActionForm>
                      </div>
                    </details>
                  ))}
                </Card>
              ) : null}
            </>
          ) : null}

          {history.length ? (
            <Card title="Retired versions" description="Kept so old orders can be traced to the exact rate they were quoted.">
              <div className="adm-table-wrap">
                <table className="adm-table" data-stack>
                  <thead><tr><th>Rate</th><th>Version</th><th className="num">Price</th><th>Retired</th></tr></thead>
                  <tbody>
                    {history.map((rate) => (
                      <tr key={rate.id}>
                        <td className="primary" data-label="Rate">{rate.name}<span className="sub">{rate.region}</span></td>
                        <td data-label="Version">v{rate.version}{rate.supersededBy ? <span className="sub">replaced</span> : <span className="sub">deactivated</span>}</td>
                        <td className="num" data-label="Price"><Money pesewas={rate.pricePesewas} /></td>
                        <td data-label="Retired">{formatDate(rate.activeTo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>

        <Card title="Quote preview" description="What checkout would offer, using the same matching rule.">
          <form className="adm-form" action="/admin/delivery">
            <div className="adm-fields">
              <label className="adm-field"><span>Region</span><select name="region" defaultValue={params.region ?? ""}><option value="">Sample destinations</option>{GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}</select></label>
              <label className="adm-field"><span>City</span><input type="text" name="city" defaultValue={params.city} /></label>
              <label className="adm-field"><span>Parcel weight (g)</span><input type="number" name="weight" min={1} defaultValue={weight} /></label>
              <label className="adm-field"><span>Order value (GH₵)</span><input type="number" name="order" min={0} step="0.01" defaultValue={orderValue / 100} /></label>
            </div>
            <div className="adm-form-foot"><button className="adm-btn" type="submit">Preview quotes</button>{params.region ? <Link className="adm-btn" data-variant="ghost" href="/admin/delivery">Reset</Link> : null}</div>
          </form>
          <div className="adm-table-wrap" style={{ marginTop: 14 }}>
            <table className="adm-table">
              <thead><tr><th>Destination</th><th className="num">Quote</th></tr></thead>
              <tbody>
                {destinations.map((destination) => {
                  const quotes = quoteDelivery(rates, { region: destination.region, city: destination.city, weightGrams: weight, orderPesewas: orderValue });
                  return (
                    <tr key={destination.label}>
                      <td>{destination.label}<span className="sub">{quotes[0] ? `${quotes[0].name} · ${quotes[0].estimate}` : "No rate — checkout would block payment"}</span></td>
                      <td className="num">{quotes[0] ? <Money pesewas={quotes[0].pricePesewas} /> : <Badge tone="red">Gap</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
