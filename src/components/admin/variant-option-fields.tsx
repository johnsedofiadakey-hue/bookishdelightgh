"use client";

import { useEffect, useRef, useState } from "react";
import { Field, FieldErrorFor } from "@/components/admin/action-form";
import { BUNDLE_CONDITIONS, CONDITION_LABELS, GRADE_DESCRIPTIONS, GRADE_LABELS, PRELOVED_GRADES, type ItemCondition, type PrelovedGrade } from "@/lib/contracts/catalog";

export interface SkuOption {
  sku: string;
  /** e.g. "The Gruffalo · Paperback · Preloved · Very good" */
  label: string;
}

interface Row {
  id: number;
  sku: string;
  title: string;
  quantity: number;
}

type ShopSection = "new" | "preloved" | "bundles";

const ghs = (pesewas?: number) => (pesewas === undefined ? "" : `${Math.floor(pesewas / 100)}.${String(pesewas % 100).padStart(2, "0")}`);

/**
 * The three public shop sections map to format and condition. Fields that do
 * not apply are not submitted.
 */
export function VariantOptionFields({
  formats,
  format: initialFormat = "Paperback",
  condition: initialCondition,
  grade,
  note,
  compareAtPesewas,
  bundleItems,
  skuOptions,
}: {
  formats: readonly string[];
  format?: string;
  condition?: ItemCondition;
  grade?: PrelovedGrade;
  note?: string;
  compareAtPesewas?: number;
  bundleItems?: { sku?: string; title: string; quantity: number }[];
  skuOptions: SkuOption[];
}) {
  const initialRows = (): Row[] => (bundleItems?.length ? bundleItems.map((item, index) => ({ id: index + 1, sku: item.sku ?? "", title: item.title, quantity: item.quantity })) : [{ id: 1, sku: "", title: "", quantity: 1 }]);
  const initialSection: ShopSection = initialFormat === "Bundle" ? "bundles" : initialCondition === "preloved" ? "preloved" : "new";
  const singleFormats = formats.filter((item) => item !== "Bundle");
  const initialSingleFormat = initialFormat === "Bundle" ? "Paperback" : initialFormat;
  const [section, setSection] = useState<ShopSection>(initialSection);
  const [singleFormat, setSingleFormat] = useState(initialSingleFormat);
  const [bundleCondition, setBundleCondition] = useState<ItemCondition | "">(initialFormat === "Bundle" ? initialCondition ?? "" : "");
  const [selectedGrade, setSelectedGrade] = useState<PrelovedGrade | "">(grade ?? "");
  const [rows, setRows] = useState<Row[]>(initialRows);
  const sectionRef = useRef<HTMLSelectElement>(null);

  const isBundle = section === "bundles";
  const effectiveCondition = isBundle ? bundleCondition : section;

  useEffect(() => {
    const form = sectionRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setSection(initialSection);
      setSingleFormat(initialSingleFormat);
      setBundleCondition(initialFormat === "Bundle" ? initialCondition ?? "" : "");
      setSelectedGrade(grade ?? "");
      setRows(initialRows());
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFormat, initialCondition, grade]);

  const update = (id: number, patch: Partial<Row>) => setRows((all) => all.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <>
      <Field name="shopGroup" label="Shop section" required hint="This decides whether the stock appears under Brand New, Preloved or Bundle Deals on the website.">
        <select ref={sectionRef} name="shopGroup" value={section} onChange={(event) => setSection(event.target.value as ShopSection)}>
          <option value="new">Brand New</option>
          <option value="preloved">Preloved</option>
          <option value="bundles">Bundle Deals</option>
        </select>
      </Field>
      {isBundle ? <input type="hidden" name="format" value="Bundle" /> : (
        <Field name="format" label="Format" required>
          <select name="format" value={singleFormat} onChange={(event) => setSingleFormat(event.target.value)}>
            {singleFormats.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
      )}
      {isBundle ? (
        <Field name="condition" label="What’s inside the bundle?" required hint="Choose Mixed if the set contains both new and preloved items.">
          <select name="condition" value={bundleCondition} onChange={(event) => setBundleCondition(event.target.value as ItemCondition | "")} required>
            <option value="">Choose a condition…</option>
            {BUNDLE_CONDITIONS.map((item) => <option key={item} value={item}>{CONDITION_LABELS[item]}</option>)}
          </select>
        </Field>
      ) : <input type="hidden" name="condition" value={section} />}
      {effectiveCondition === "preloved" ? (
        <>
          <Field name="conditionGrade" label="Grade" required hint={selectedGrade ? GRADE_DESCRIPTIONS[selectedGrade] : isBundle ? "The grade of the most worn book in the bundle." : "How worn is this copy?"}>
            <select name="conditionGrade" value={selectedGrade} onChange={(event) => setSelectedGrade(event.target.value as PrelovedGrade | "")} required>
              <option value="">Choose a grade…</option>
              {PRELOVED_GRADES.map((item) => <option key={item} value={item}>{GRADE_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field name="conditionNote" label="Condition note" hint="Shown to customers. Mention anything notable, e.g. a name inside the cover.">
            <input type="text" name="conditionNote" defaultValue={note} maxLength={160} />
          </Field>
        </>
      ) : null}
      {isBundle ? (
        <>
          <Field name="compareAtPesewas" label="Worth if bought separately (GH₵)" hint="Optional. Shown as “You save …” when higher than the price.">
            <input type="text" name="compareAt" inputMode="decimal" defaultValue={ghs(compareAtPesewas)} placeholder="e.g. 250.00" />
          </Field>
          <fieldset className="wide adm-bundle-items">
            <legend className="adm-field"><span>What’s inside <span className="req">*</span></span></legend>
            <p className="adm-small adm-muted" style={{ margin: "0 0 10px" }}>
              Pick books you also stock singly so “Make up bundles” in Inventory can move them into this bundle. For anything not listed separately, leave “Stocked item” empty and just type its title.
            </p>
            {rows.map((row) => (
              <div className="adm-bundle-row" key={row.id}>
                <label className="adm-field">
                  <span>Stocked item</span>
                  <select name="bundleSku" value={row.sku} onChange={(event) => update(row.id, { sku: event.target.value })}>
                    <option value="">Not listed separately</option>
                    {skuOptions.map((option) => <option key={option.sku} value={option.sku}>{option.label} ({option.sku})</option>)}
                  </select>
                </label>
                <label className="adm-field">
                  <span>{row.sku ? "Title shown (optional)" : "Title"}</span>
                  <input type="text" name="bundleTitle" value={row.title} onChange={(event) => update(row.id, { title: event.target.value })} maxLength={120} placeholder={row.sku ? "Uses the book’s title" : "e.g. Peppa Pig sticker book"} />
                </label>
                <label className="adm-field adm-bundle-qty">
                  <span>Qty</span>
                  <input type="number" name="bundleQty" min={1} max={20} value={row.quantity} onChange={(event) => update(row.id, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} />
                </label>
                {rows.length > 1 ? (
                  <button className="adm-btn" type="button" data-size="sm" data-variant="ghost" onClick={() => setRows((all) => all.filter((item) => item.id !== row.id))} aria-label="Remove this item">
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button className="adm-btn" type="button" data-size="sm" onClick={() => setRows((all) => [...all, { id: Math.max(...all.map((item) => item.id)) + 1, sku: "", title: "", quantity: 1 }])}>
              + Add an item
            </button>
            <FieldErrorFor name="bundleItems" />
          </fieldset>
        </>
      ) : null}
    </>
  );
}
