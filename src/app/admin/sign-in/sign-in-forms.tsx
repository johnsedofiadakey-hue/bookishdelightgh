"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { idleState } from "@/lib/admin/action-state";
import { devSignInAction } from "../session-actions";

/**
 * Email/password sign-in through the Firebase Auth REST API (no client SDK
 * needed). The resulting ID token is sent once to /admin/api/session, which
 * verifies it server-side and sets an httpOnly session cookie.
 */
export function FirebaseSignInForm({ apiKey, emulatorHost }: { apiKey: string; emulatorHost: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const base = emulatorHost ? `http://${emulatorHost}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const auth = await fetch(`${base}/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), returnSecureToken: true }),
      });
      const body = (await auth.json()) as { idToken?: string; error?: { message?: string } };
      if (!auth.ok || !body.idToken) {
        const code = body.error?.message ?? "";
        setError(/INVALID|EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/.test(code) ? "Email or password is incorrect." : /TOO_MANY/.test(code) ? "Too many attempts. Wait a few minutes and try again." : /USER_DISABLED/.test(code) ? "This account has been disabled." : "Sign-in failed. Try again.");
        return;
      }
      const session = await fetch("/admin/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: body.idToken }) });
      if (!session.ok) {
        const payload = (await session.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Your account could not be verified for staff access.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="adm-form" method="post" onSubmit={onSubmit}>
      <label className="adm-field">
        <span>Work email</span>
        <input type="email" name="email" autoComplete="username" required />
      </label>
      <label className="adm-field">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <div aria-live="polite">
        {error ? <p className="adm-form-message" data-status="error">{error}</p> : null}
      </div>
      <button className="adm-btn" data-variant="primary" type="submit" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

export function DevSignIn({ accounts }: { accounts: { uid: string; label: string; description: string }[] }) {
  const [state, action, pending] = useActionState(devSignInAction, idleState);
  return (
    <div className="adm-callout" data-tone="warn">
      <strong>Development sign-in (local fixtures only)</strong>
      <p style={{ margin: "4px 0 10px" }}>Uses the in-memory dev store. Unavailable when the Firestore adapter is active or in production.</p>
      <form action={action} className="adm-dev-accounts">
        {accounts.map((account) => (
          <button key={account.uid} className="adm-btn" type="submit" name="uid" value={account.uid} disabled={pending} aria-describedby={`dev-${account.uid}`}>
            <span>{account.label}</span>
            <span className="adm-small adm-muted" id={`dev-${account.uid}`}>{account.description}</span>
          </button>
        ))}
      </form>
      {state.status === "error" ? <p className="adm-form-message" data-status="error">{state.message}</p> : null}
    </div>
  );
}
