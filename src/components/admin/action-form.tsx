"use client";

import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { idleState, type ActionState } from "@/lib/admin/action-state";

type ServerAction = (state: ActionState, form: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(idleState);

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Every admin mutation goes through this form:
 * - a hidden idempotency key, so double-clicks and network retries are
 *   recognised server-side and never apply twice (a new key is issued only
 *   after a success);
 * - the submit button disables while the request is in flight;
 * - optional two-step confirmation for destructive actions only;
 * - result messages are announced via aria-live.
 */
export function ActionForm({
  action,
  idempotencyKey,
  submitLabel,
  pendingLabel = "Saving…",
  variant = "primary",
  size,
  confirm,
  resetOnSuccess = false,
  inline = false,
  className,
  children,
  footer,
}: {
  action: ServerAction;
  idempotencyKey: string;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "coral" | "danger" | "danger-solid" | "default" | "ghost";
  size?: "sm";
  /** When set, the first click asks for confirmation with this message. */
  confirm?: string;
  resetOnSuccess?: boolean;
  inline?: boolean;
  className?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [key, setKey] = useState(idempotencyKey);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      setKey(newKey());
      setConfirming(false);
      if (resetOnSuccess) formRef.current?.reset();
      if (state.redirectTo) router.push(state.redirectTo);
    }
  }, [state, resetOnSuccess, router]);

  const submit = (
    <button className="adm-btn" data-variant={confirming ? "danger-solid" : variant === "default" ? undefined : variant} data-size={size} type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : confirming ? "Yes, confirm" : submitLabel}
    </button>
  );

  return (
    <FormStateContext.Provider value={state}>
      <form
        ref={formRef}
        action={formAction}
        className={className ?? (inline ? "adm-inline-form" : "adm-form")}
        onSubmit={(event) => {
          if (confirm && !confirming) {
            event.preventDefault();
            setConfirming(true);
          }
        }}
        noValidate={false}
      >
        <input type="hidden" name="idempotencyKey" value={key} />
        {children}
        {confirming && confirm ? (
          <div className="adm-confirm" role="alertdialog" aria-live="assertive">
            <p>{confirm}</p>
            <div className="adm-form-foot">
              {submit}
              <button className="adm-btn" data-size={size} type="button" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="adm-form-foot">
            {submit}
            {footer}
          </div>
        )}
        <div aria-live="polite" aria-atomic="true">
          {state.status !== "idle" && state.message ? (
            <p className="adm-form-message" data-status={state.status} key={state.at}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </FormStateContext.Provider>
  );
}

/** Label + control + inline error from the surrounding ActionForm's last result. */
export function Field({ name, label, hint, required, wide, children }: { name: string; label: string; hint?: ReactNode; required?: boolean; wide?: boolean; children: ReactNode }) {
  const state = useContext(FormStateContext);
  const error = state.status === "error" ? state.fieldErrors?.[name] : undefined;
  return (
    <label className={`adm-field${wide ? " wide" : ""}`} data-invalid={error ? "true" : undefined}>
      <span>
        {label}
        {required ? <span className="req"> *</span> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? (
        <span className="adm-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/** Shows a field-level error that has no single input (e.g. a list of lines). */
export function FieldErrorFor({ name }: { name: string }) {
  const state = useContext(FormStateContext);
  const error = state.status === "error" ? state.fieldErrors?.[name] : undefined;
  return error ? (
    <p className="adm-field-error" role="alert">
      {error}
    </p>
  ) : null;
}
