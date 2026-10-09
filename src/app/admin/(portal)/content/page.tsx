import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ActionForm, Field } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { Callout, Card, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { can } from "@/lib/admin/context";
import { formatDateTime } from "@/lib/admin/format";
import { listCategories } from "@/lib/admin/ops/catalogue";
import { getHomepage } from "@/lib/admin/ops/content";
import { getAdminStore } from "@/lib/admin/store";
import type { Book } from "@/lib/admin/types";
import { publishHomepageAction, saveHomepageAction } from "./actions";

export const metadata = { title: "Homepage" };

function BookChecks({ name, books, selected }: { name: string; books: Book[]; selected: string[] }) {
  if (!books.length) return <p className="adm-small adm-muted">Publish books first; only published books can be featured.</p>;
  return (
    <div className="adm-checks" style={{ maxHeight: 170, overflowY: "auto" }}>
      {books.map((book) => (
        <label className="adm-check" key={book.id}>
          <input type="checkbox" name={name} value={book.id} defaultChecked={selected.includes(book.id)} /> {book.title}
        </label>
      ))}
    </div>
  );
}

export default async function ContentPage() {
  const access = await pageAccess("content.view");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const { ctx } = access;
  const store = getAdminStore();
  const [doc, categories, published] = await Promise.all([getHomepage(store, ctx), listCategories(store), store.query("books", { where: [["status", "==", "published"]] })]);
  const draft = doc.draft;
  const editable = can(ctx, "content.edit");
  const unpublishedChanges = JSON.stringify(doc.draft) !== JSON.stringify(doc.published ?? null);

  return (
    <>
      <PageHeader
        eyebrow="Shelf"
        title="Homepage"
        lede="Edit a draft, then publish. The storefront reads only the published version."
        actions={
          can(ctx, "content.publish") ? (
            <ActionForm action={publishHomepageAction} idempotencyKey={randomUUID()} submitLabel="Publish homepage" variant="coral" inline confirm="Publish the current draft to the live storefront?" />
          ) : null
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Callout tone={unpublishedChanges ? "warn" : "ok"}>
          {doc.publishedAt ? <>Last published {formatDateTime(doc.publishedAt)}. </> : <>Never published — the storefront is using its built-in copy. </>}
          {unpublishedChanges ? "The draft has unpublished changes." : "The draft matches what is live."}
        </Callout>
      </div>

      <div className="adm-grid adm-grid-main">
        <ActionForm action={saveHomepageAction} idempotencyKey={randomUUID()} submitLabel="Save draft" className="adm-stack">
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 16 }}>
            <Card title="Hero">
              <div className="adm-fields">
                <Field name="heroEyebrow" label="Eyebrow"><input type="text" name="heroEyebrow" defaultValue={draft.hero.eyebrow} maxLength={60} /></Field>
                <Field name="heroCtaLabel" label="Button label"><input type="text" name="heroCtaLabel" defaultValue={draft.hero.ctaLabel} maxLength={40} /></Field>
                <Field name="heroHeading" label="Heading" required wide><input type="text" name="heroHeading" defaultValue={draft.hero.heading} maxLength={120} required /></Field>
                <Field name="heroIntro" label="Intro" wide><textarea name="heroIntro" defaultValue={draft.hero.intro} rows={3} maxLength={300} /></Field>
                <Field name="heroCtaHref" label="Button link" hint="A page on this site, e.g. /shop"><input type="text" name="heroCtaHref" defaultValue={draft.hero.ctaHref} /></Field>
              </div>
            </Card>
            <Card title="Announcement strip">
              <div className="adm-fields">
                <Field name="announcementText" label="Text" wide><input type="text" name="announcementText" defaultValue={draft.announcement.text} maxLength={140} /></Field>
                <label className="adm-check"><input type="checkbox" name="announcementEnabled" defaultChecked={draft.announcement.enabled} /> Show the strip</label>
              </div>
            </Card>
            <Card title="Featured shelves" description="Only published books can be featured; publishing is blocked otherwise.">
              <div className="adm-stack">
                {draft.featuredShelves.map((shelf) => (
                  <fieldset key={shelf.id}>
                    <legend className="adm-field"><span>Shelf</span></legend>
                    <input type="hidden" name="shelfId" value={shelf.id} />
                    <div className="adm-stack">
                      <Field name={`shelfTitle:${shelf.id}`} label="Title" hint="Clear the title to remove this shelf."><input type="text" name={`shelfTitle:${shelf.id}`} defaultValue={shelf.title} /></Field>
                      <BookChecks name={`shelfBooks:${shelf.id}`} books={published} selected={shelf.bookIds} />
                    </div>
                  </fieldset>
                ))}
                <Field name="newShelfTitle" label="Add a shelf" hint="Type a title to add a new shelf on save."><input type="text" name="newShelfTitle" placeholder="e.g. Back-to-school picks" /></Field>
              </div>
            </Card>
            <Card title="Ghanaian stories picks">
              <BookChecks name="ghanaianPicks" books={published} selected={draft.ghanaianPicks} />
            </Card>
            <Card title="Trust & delivery copy">
              <div className="adm-fields">
                <Field name="trustPoints" label="Trust points" hint="One per line, up to 6." wide><textarea name="trustPoints" rows={4} defaultValue={draft.trustPoints.join("\n")} /></Field>
                <Field name="deliveryCopy" label="Delivery explanation" wide hint="Do not promise universal same-day delivery."><textarea name="deliveryCopy" rows={2} defaultValue={draft.deliveryCopy} maxLength={300} /></Field>
              </div>
            </Card>
          </fieldset>
        </ActionForm>

        <div className="adm-stack">
          <Card title="Hero image" description="Saved to the draft. Alt text is required.">
            {draft.hero.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.hero.image.url} alt={draft.hero.image.alt} style={{ width: "100%", height: "auto", borderRadius: 10, marginBottom: 12 }} />
            ) : (
              <p className="adm-small adm-muted">No hero image in the draft; the storefront keeps its current artwork.</p>
            )}
            {editable ? <ImageUpload target="hero" ownerId="hero" label={draft.hero.image ? "Replace hero image" : "Upload hero image"} /> : null}
          </Card>
          <Card title="Categories" description="Category tiles on the homepage come from your categories.">
            <p className="adm-small" style={{ margin: 0 }}>{categories.length} categor{categories.length === 1 ? "y" : "ies"}. Add, rename, reorder or hide them on the <Link className="adm-link" href="/admin/categories">Categories page</Link>.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
