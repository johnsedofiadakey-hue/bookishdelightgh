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
      <PageHeader eyebrow="Admin" title="Settings" lede={`Settings for the whole shop. Last changed ${formatDateTime(settings.updatedAt)}.`} />
      <div className="adm-grid adm-grid-main">
        <ActionForm action={saveSettingsAction} idempotencyKey={randomUUID()} submitLabel="Save settings" className="adm-stack">
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 16 }}>
            <Card title="Support contacts" description="Customers see these on the website and at the end of text messages.">
              <div className="adm-fields adm-fields-3">
                <Field name="supportPhone" label="Phone"><input type="tel" name="supportPhone" defaultValue={settings.supportPhone} /></Field>
                <Field name="supportWhatsApp" label="WhatsApp"><input type="tel" name="supportWhatsApp" defaultValue={settings.supportWhatsApp} /></Field>
                <Field name="supportEmail" label="Email"><input type="email" name="supportEmail" defaultValue={settings.supportEmail} /></Field>
              </div>
            </Card>
            <Card title="Where orders are sent from" description="Where parcels leave from. Used for delivery times and pick-up.">
              <div className="adm-fields adm-fields-3">
                <Field name="originRegion" label="Region" required><select name="originRegion" defaultValue={settings.fulfilmentOrigin.region}>{GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}</select></Field>
                <Field name="originCity" label="Town"><input type="text" name="originCity" defaultValue={settings.fulfilmentOrigin.city} /></Field>
                <Field name="originAddress" label="Pick-up address"><input type="text" name="originAddress" defaultValue={settings.fulfilmentOrigin.addressLine} /></Field>
              </div>
            </Card>
            <Card title="Policies & stock">
              <div className="adm-fields">
                <Field name="returnsPolicyUrl" label="Returns policy link"><input type="text" name="returnsPolicyUrl" defaultValue={settings.returnsPolicyUrl} /></Field>
                <Field name="defaultLowStockThreshold" label="Low stock warning at" hint="Used for new items."><input type="number" name="defaultLowStockThreshold" min={0} max={100} defaultValue={settings.defaultLowStockThreshold} /></Field>
                <Field name="maintenanceBanner" label="Website notice" wide hint="Optional message at the top of the shop, e.g. delivery delays over the holidays."><input type="text" name="maintenanceBanner" defaultValue={settings.maintenanceBanner} maxLength={160} /></Field>
              </div>
            </Card>
            <Card title="On/off switches" description="Changes are saved in the activity log.">
              <div className="adm-stack">
                <label className="adm-check"><input type="checkbox" name="checkoutEnabled" defaultChecked={settings.checkoutEnabled} /> <span><strong>Online payment on</strong><br /><span className="adm-small adm-muted">When off, customers can look around but can’t pay online.</span></span></label>
                <label className="adm-check"><input type="checkbox" name="smsEnabled" defaultChecked={settings.smsEnabled} /> <span><strong>Order text messages</strong><br /><span className="adm-small adm-muted">When off, messages are saved as “suppressed” and not sent.</span></span></label>
              </div>
            </Card>
          </fieldset>
        </ActionForm>
        <div className="adm-stack">
          <Callout tone="info" title="Payment and SMS keys can’t be changed here">
            The Paystack and mNotify keys and the SMS sender name are stored safely on the server. They never reach the browser.
          </Callout>
          <Card title="System">
            <dl className="adm-dl">
              <dt>Database</dt><dd>{configuredStoreKind() === "memory" ? "Test data (not saved)" : "Firestore"}</dd>
              <dt>Staff sign-in</dt><dd>{firebaseSignInConfigured() ? "Firebase Auth" : "Not set up"}</dd>
              <dt>Stay signed in for</dt><dd>{SESSION_TTL_HOURS} hours</dd>
            </dl>
          </Card>
          <Card title="Your devices">
            <ActionForm action={signOutEverywhereAction} idempotencyKey={randomUUID()} submitLabel="Sign out on all devices" variant="danger" confirm="Sign out on every device, including this one?" />
          </Card>
        </div>
      </div>
    </>
  );
}
