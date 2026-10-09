import { randomUUID } from "node:crypto";
import { ActionForm, Field } from "@/components/admin/action-form";
import { Callout, Card, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { configuredStoreKind, firebaseSignInConfigured, SESSION_TTL_HOURS } from "@/lib/admin/env";
import { formatDateTime } from "@/lib/admin/format";
import { getSettings } from "@/lib/admin/ops/content";
import { getAdminStore } from "@/lib/admin/store";
import { GHANA_REGIONS } from "@/lib/admin/validation";
import { saveSettingsAction, signOutEverywhereAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const access = await pageAccess("settings.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const settings = await getSettings(getAdminStore(), ctx);
  const editable = can(ctx, "settings.edit");

  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" lede={`Operational settings. Last changed ${formatDateTime(settings.updatedAt)}.`} />
      <div className="adm-grid adm-grid-main">
        <ActionForm action={saveSettingsAction} idempotencyKey={randomUUID()} submitLabel="Save settings" className="adm-stack">
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 16 }}>
            <Card title="Support contacts" description="Shown on the storefront and in SMS footers.">
              <div className="adm-fields adm-fields-3">
                <Field name="supportPhone" label="Phone"><input type="tel" name="supportPhone" defaultValue={settings.supportPhone} /></Field>
                <Field name="supportWhatsApp" label="WhatsApp"><input type="tel" name="supportWhatsApp" defaultValue={settings.supportWhatsApp} /></Field>
                <Field name="supportEmail" label="Email"><input type="email" name="supportEmail" defaultValue={settings.supportEmail} /></Field>
              </div>
            </Card>
            <Card title="Fulfilment origin" description="Where parcels leave from. Used for delivery estimates and pickup.">
              <div className="adm-fields adm-fields-3">
                <Field name="originRegion" label="Region" required><select name="originRegion" defaultValue={settings.fulfilmentOrigin.region}>{GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}</select></Field>
                <Field name="originCity" label="City / town"><input type="text" name="originCity" defaultValue={settings.fulfilmentOrigin.city} /></Field>
                <Field name="originAddress" label="Pickup address"><input type="text" name="originAddress" defaultValue={settings.fulfilmentOrigin.addressLine} /></Field>
              </div>
            </Card>
            <Card title="Policies & stock">
              <div className="adm-fields">
                <Field name="returnsPolicyUrl" label="Returns policy link"><input type="text" name="returnsPolicyUrl" defaultValue={settings.returnsPolicyUrl} /></Field>
                <Field name="defaultLowStockThreshold" label="Default low-stock threshold" hint="Applied to new SKUs."><input type="number" name="defaultLowStockThreshold" min={0} max={100} defaultValue={settings.defaultLowStockThreshold} /></Field>
                <Field name="maintenanceBanner" label="Storefront notice" wide hint="Optional banner, e.g. holiday dispatch delays."><input type="text" name="maintenanceBanner" defaultValue={settings.maintenanceBanner} maxLength={160} /></Field>
              </div>
            </Card>
            <Card title="Operational switches" description="Changes are audited.">
              <div className="adm-stack">
                <label className="adm-check"><input type="checkbox" name="checkoutEnabled" defaultChecked={settings.checkoutEnabled} /> <span><strong>Checkout open</strong><br /><span className="adm-small adm-muted">When off, shoppers can browse but cannot pay. Shared commerce must honour this flag.</span></span></label>
                <label className="adm-check"><input type="checkbox" name="smsEnabled" defaultChecked={settings.smsEnabled} /> <span><strong>Transactional SMS</strong><br /><span className="adm-small adm-muted">When off, order events are logged as “suppressed” instead of queued.</span></span></label>
              </div>
            </Card>
          </fieldset>
        </ActionForm>
        <div className="adm-stack">
          <Callout tone="info" title="Provider secrets are not editable here">
            Paystack and mNotify keys and the sender ID live in the deployment secret manager and are used only by server code. The browser never sees them.
          </Callout>
          <Card title="Environment">
            <dl className="adm-dl">
              <dt>Data store</dt><dd>{configuredStoreKind() === "memory" ? "Development (in-memory)" : "Firestore"}</dd>
              <dt>Staff sign-in</dt><dd>{firebaseSignInConfigured() ? "Firebase Auth" : "Not configured"}</dd>
              <dt>Session length</dt><dd>{SESSION_TTL_HOURS} hours</dd>
            </dl>
          </Card>
          <Card title="Your sessions">
            <ActionForm action={signOutEverywhereAction} idempotencyKey={randomUUID()} submitLabel="Sign out on all devices" variant="danger" confirm="End every session you have open, including this one?" />
          </Card>
        </div>
      </div>
    </>
  );
}
