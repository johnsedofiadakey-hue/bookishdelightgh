"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/admin/action-form";
import type { ActionState } from "@/lib/admin/action-state";
import { AGE_BANDS, type Book, type Category } from "@/lib/admin/types";

const AGE_LABELS: Record<(typeof AGE_BANDS)[number], string> = {
  "0-3": "Babies & toddlers (0–3)",
  "4-7": "Early readers (4–7)",
  "8-12": "Middle grade (8–12)",
  "13-17": "Teen (13–17)",
  adult: "Adult",
  "all-ages": "All ages",
};

function slugPreview(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function BookForm({
  action,
  idempotencyKey,
  book,
  categories,
  otherBooks,
  disabled,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  idempotencyKey: string;
  book?: Book;
  categories: Category[];
  otherBooks: { id: string; title: string; status: Book["status"] }[];
  disabled?: boolean;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [seoDescription, setSeoDescription] = useState(book?.seoDescription ?? "");

  return (
    <ActionForm action={action} idempotencyKey={idempotencyKey} submitLabel={book ? "Save details" : "Create draft"}>
      {book ? <input type="hidden" name="bookId" value={book.id} /> : null}
      <fieldset disabled={disabled} style={{ border: 0, padding: 0 }}>
        <div className="adm-fields">
          <Field name="title" label="Title" required wide>
            <input type="text" name="title" defaultValue={book?.title} required maxLength={200} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field name="subtitle" label="Subtitle">
            <input type="text" name="subtitle" defaultValue={book?.subtitle} maxLength={200} />
          </Field>
          <Field name="slug" label="URL slug" hint={`/books/${book?.slug ?? (slugPreview(title) || "…")}`}>
            <input type="text" name="slug" defaultValue={book?.slug} placeholder={slugPreview(title) || "auto from title"} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </Field>
          <Field name="authors" label="Author(s)" required hint="Separate several authors with commas.">
            <input type="text" name="authors" defaultValue={book?.authors.join(", ")} required />
          </Field>
          <Field name="publisher" label="Publisher">
            <input type="text" name="publisher" defaultValue={book?.publisher} />
          </Field>
          <Field name="language" label="Language">
            <input type="text" name="language" defaultValue={book?.language ?? "English"} list="adm-languages" />
          </Field>
          <Field name="ageBand" label="Age band" required>
            <select name="ageBand" defaultValue={book?.ageBand ?? "all-ages"}>
              {AGE_BANDS.map((band) => <option key={band} value={band}>{AGE_LABELS[band]}</option>)}
            </select>
          </Field>
          <fieldset className="wide">
            <legend className="adm-field"><span>Categories</span></legend>
            <div className="adm-checks">
              {categories.map((category) => (
                <label className="adm-check" key={category.id}>
                  <input type="checkbox" name="categoryIds" value={category.id} defaultChecked={book?.categoryIds.includes(category.id)} />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field name="tags" label="Tags" wide hint="Comma separated, e.g. adventure, friendship, accra">
            <input type="text" name="tags" defaultValue={book?.tags.join(", ")} />
          </Field>
          <Field name="description" label="Description" wide hint="Shown on the book page. At least 20 characters before publishing.">
            <textarea name="description" defaultValue={book?.description} rows={6} maxLength={5000} />
          </Field>
          <Field name="seoTitle" label="SEO title" hint="Max 70 characters. Defaults to the title.">
            <input type="text" name="seoTitle" defaultValue={book?.seoTitle} maxLength={70} />
          </Field>
          <Field name="seoDescription" label="SEO description" hint={`${seoDescription.length}/170`}>
            <input type="text" name="seoDescription" defaultValue={book?.seoDescription} maxLength={170} onChange={(event) => setSeoDescription(event.target.value)} />
          </Field>
          {otherBooks.length ? (
            <fieldset className="wide">
              <legend className="adm-field"><span>Related books</span></legend>
              <div className="adm-checks" style={{ maxHeight: 160, overflowY: "auto" }}>
                {otherBooks.map((other) => (
                  <label className="adm-check" key={other.id}>
                    <input type="checkbox" name="relatedBookIds" value={other.id} defaultChecked={book?.relatedBookIds.includes(other.id)} />
                    {other.title}
                    {other.status !== "published" ? <span className="adm-muted adm-small"> ({other.status})</span> : null}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
        <datalist id="adm-languages">
          <option value="English" />
          <option value="Twi" />
          <option value="Ewe" />
          <option value="Ga" />
          <option value="Fante" />
          <option value="Dagbani" />
          <option value="French" />
        </datalist>
      </fieldset>
    </ActionForm>
  );
}
