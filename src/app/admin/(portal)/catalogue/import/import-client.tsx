"use client";

import { useActionState, useState } from "react";
import { ActionForm, Field } from "@/components/admin/action-form";
import { idleState, type ActionState } from "@/lib/admin/action-state";
import type { ImportPlan } from "@/lib/admin/ops/catalogue-import";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

const ACTION_LABELS: Record<ImportPlan["rows"][number]["action"], string> = {
  create_book_and_variant: "New book + variant",
  add_variant_to_new_book: "Variant of a new book",
  add_variant_to_existing_book: "Variant of existing book",
  error: "Error",
};

export function ImportFlow({ dryRun, commit, commitKey }: { dryRun: Action; commit: Action; commitKey: string }) {
  const [state, action, pending] = useActionState(dryRun, idleState);
  const [confirmed, setConfirmed] = useState(false);
  const plan = state.status === "success" ? (state.data?.plan as ImportPlan | undefined) : undefined;
  const csv = state.status === "success" ? (state.data?.csv as string | undefined) : undefined;

  return (
    <div className="adm-stack">
      <section className="adm-card">
        <div className="adm-card-head"><div><h2>1 · Dry run</h2><p>Validates every row against the catalogue. Nothing is written.</p></div></div>
        <form action={action} className="adm-form">
          <label className="adm-field">
            <span>CSV file</span>
            <input type="file" name="file" accept=".csv,text/csv" required />
            <small>UTF-8 CSV, up to 80 rows and 500 KB.</small>
          </label>
          <div className="adm-form-foot">
            <button className="adm-btn" data-variant="primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Run dry run"}</button>
          </div>
          <div aria-live="polite">{state.status !== "idle" ? <p className="adm-form-message" data-status={state.status}>{state.message}</p> : null}</div>
        </form>
      </section>

      {plan ? (
        <section className="adm-card">
          <div className="adm-card-head">
            <div>
              <h2>Dry-run results</h2>
              <p>{plan.newBooks} new book(s) · {plan.newVariants} variant(s) · {plan.openingUnits} opening unit(s) · {plan.errorCount} problem(s)</p>
            </div>
          </div>
          {plan.headerProblems.length ? <div className="adm-callout" data-tone="danger" style={{ marginBottom: 12 }}><ul>{plan.headerProblems.map((problem) => <li key={problem}>{problem}</li>)}</ul></div> : null}
          <div className="adm-table-wrap">
            <table className="adm-table" data-stack>
              <thead><tr><th>Line</th><th>SKU</th><th>Book slug</th><th>Result</th><th className="num">Opening</th></tr></thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.line}>
                    <td data-label="Line">{row.line}</td>
                    <td className="adm-mono" data-label="SKU">{row.sku || "—"}</td>
                    <td className="adm-mono" data-label="Book slug">{row.bookSlug}</td>
                    <td className="primary" data-label="Result">
                      <span className="adm-badge" data-tone={row.action === "error" ? "red" : "green"}>{ACTION_LABELS[row.action]}</span>
                      {row.errors.map((error) => <span key={error} className="sub" style={{ color: "var(--red)" }}>{error}</span>)}
                    </td>
                    <td className="num" data-label="Opening">{row.openingQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {plan && plan.errorCount === 0 && csv ? (
        <section className="adm-card">
          <div className="adm-card-head"><div><h2>2 · Confirm import</h2><p>Creates draft books and variants in one all-or-nothing transaction. Opening quantities are recorded as STOCK_RECEIVED movements. Nothing is published.</p></div></div>
          <ActionForm action={commit} idempotencyKey={commitKey} submitLabel={`Import ${plan.newVariants} variant(s)`} variant="coral" pendingLabel="Importing…">
            <input type="hidden" name="csvText" value={csv} />
            <input type="hidden" name="fileHash" value={plan.fileHash} />
            <Field name="confirm" label="Confirmation">
              <label className="adm-check">
                <input type="checkbox" name="confirm" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                I’ve reviewed the dry run and want to write these {plan.newVariants} variant(s).
              </label>
            </Field>
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}
