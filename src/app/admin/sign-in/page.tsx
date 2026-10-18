import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { icons } from "@/components/admin/icons";
import { Callout } from "@/components/admin/ui";
import { currentSession } from "@/lib/admin/auth/guard";
import { devSignInEnabled, firebaseSignInConfigured, firebaseWebConfig } from "@/lib/admin/env";
import { isAdminError } from "@/lib/admin/errors";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/admin/permissions";
import { DEV_STAFF } from "@/lib/admin/store/dev-seed";
import { DevSignIn, FirebaseSignInForm } from "./sign-in-forms";

export const metadata: Metadata = { title: "Staff sign-in" };

const reasons: Record<string, { tone: "info" | "warn"; text: string }> = {
  expired: { tone: "warn", text: "You were signed out because it’s been a while. Please sign in again." },
  revoked: { tone: "warn", text: "You were signed out because the owner changed your access. Please sign in again." },
  inactive: { tone: "warn", text: "This staff account is turned off. Ask the owner." },
  invalid: { tone: "warn", text: "We couldn’t check your sign-in. Please sign in again." },
  signed_out: { tone: "info", text: "You have signed out." },
  unavailable: { tone: "warn", text: "The admin couldn’t reach the database. See below." },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  let storeProblem: string | null = null;
  try {
    const session = await currentSession();
    if (session.ok) redirect("/admin");
  } catch (error) {
    if (isAdminError(error)) storeProblem = error.message;
    else throw error;
  }
  const notice = reason ? reasons[reason] : undefined;
  const config = firebaseWebConfig();

  return (
    <div className="adm-auth">
      <section className="adm-auth-art" aria-hidden="true">
        <span className="adm-brand-type" style={{ fontSize: 26 }}>
          bookish<i>delight</i>
          <small>ADMIN · GHANA</small>
        </span>
        <div>
          <h1>
            Every book,
            <br />
            every order, <em>in order.</em>
          </h1>
          <p>Products, stock, orders and delivery for Bookish Delight staff.</p>
        </div>
      </section>
      <section className="adm-auth-panel">
        <div className="adm-auth-card">
          <Link className="adm-btn adm-auth-back" data-variant="ghost" data-size="sm" href="/">
            {icons.back}
            Back to store
          </Link>
          <div>
            <p className="adm-eyebrow">STAFF ONLY</p>
            <h2>Sign in</h2>
            <p className="adm-muted">The owner gives staff access. You can’t sign up here.</p>
          </div>
          {notice ? <Callout tone={notice.tone}>{notice.text}</Callout> : null}
          {storeProblem ? <Callout tone="danger" title="Can’t load admin data">{storeProblem}</Callout> : null}
          {firebaseSignInConfigured() ? (
            <FirebaseSignInForm apiKey={config.apiKey} emulatorHost={config.authEmulatorHost} />
          ) : (
            <Callout tone="info" title="Firebase sign-in is not set up">
              Set <code className="adm-mono">NEXT_PUBLIC_FIREBASE_API_KEY</code> and <code className="adm-mono">NEXT_PUBLIC_FIREBASE_PROJECT_ID</code> to turn on staff sign-in with email and password.
            </Callout>
          )}
          {devSignInEnabled() && !storeProblem ? (
            <DevSignIn accounts={DEV_STAFF.map((staff) => ({ uid: staff.uid, label: ROLE_LABELS[staff.role], description: ROLE_DESCRIPTIONS[staff.role] }))} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
