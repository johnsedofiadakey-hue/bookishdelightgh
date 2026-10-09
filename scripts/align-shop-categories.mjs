/** One-off, audited alignment of the live shelves with the owner's agreed list. */
import { randomUUID } from "node:crypto";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { RECOMMENDED_CATEGORIES, RETIRED_CATEGORY_SLUGS } from "../src/lib/admin/recommended-categories.ts";

const args = process.argv.slice(2);
const project = args[args.indexOf("--project") + 1];
const apply = args.includes("--apply");
if (!project || project.startsWith("--")) throw new Error("Usage: node --import ./src/lib/admin/__tests__/register.mjs scripts/align-shop-categories.mjs --project PROJECT_ID [--apply]");
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: project }));
const requested = new Map(RECOMMENDED_CATEGORIES.map((category) => [category.slug, category]));

function changesFor(categories) {
  const bySlug = new Map(categories.map((item) => [item.data().slug, item]));
  const unknown = categories.filter((item) => item.data().published && !requested.has(item.data().slug) && !RETIRED_CATEGORY_SLUGS.has(item.data().slug));
  if (unknown.length) throw new Error(`Unknown visible shelves; review manually first: ${unknown.map((item) => item.data().slug).join(", ")}`);
  const changes = [];
  for (const target of RECOMMENDED_CATEGORIES) {
    const current = bySlug.get(target.slug);
    const wanted = { name: target.name, slug: target.slug, caption: target.caption, order: target.order, published: true };
    if (!current || Object.entries(wanted).some(([key, value]) => current.data()[key] !== value)) {
      changes.push({ id: current?.id ?? target.slug, before: current?.data() ?? null, after: wanted, create: !current });
    }
  }
  for (const current of categories) {
    if (current.data().published && RETIRED_CATEGORY_SLUGS.has(current.data().slug)) {
      changes.push({ id: current.id, before: current.data(), after: { published: false }, create: false });
    }
  }
  return changes;
}

const [books, existing] = await Promise.all([db.collection("books").limit(1).get(), db.collection("categories").get()]);
if (!books.empty) throw new Error("Books already exist. Review their category assignments before changing live shelves.");
const preview = changesFor(existing.docs);
console.log(JSON.stringify({ project, action: apply ? "apply" : "dry_run", changes: preview.map(({ id, after }) => ({ id, ...after })) }, null, 2));
if (!apply) process.exit(0);

await db.runTransaction(async (tx) => {
  const [currentBooks, currentCategories] = await Promise.all([
    tx.get(db.collection("books").limit(1)),
    tx.get(db.collection("categories")),
  ]);
  if (!currentBooks.empty) throw new Error("Books appeared during alignment. Stop and review their categories.");
  const changes = changesFor(currentCategories.docs);
  const at = Timestamp.now();
  const requestId = `catalogue_align_${randomUUID()}`;
  for (const change of changes) {
    const ref = db.collection("categories").doc(change.id);
    if (change.create) tx.create(ref, { id: change.id, ...change.after, updatedAt: at });
    else tx.update(ref, { ...change.after, updatedAt: at });
    const auditRef = db.collection("auditEvents").doc(`aud_${randomUUID().replaceAll("-", "")}`);
    tx.create(auditRef, {
      id: auditRef.id,
      actorUid: "system:catalogue-alignment",
      actorName: "Catalogue alignment",
      actorRole: "system",
      action: change.create ? "catalogue.category.create" : "catalogue.category.update",
      entityType: "category",
      entityId: change.id,
      summary: `${change.create ? "Created" : "Aligned"} ${change.after.name ?? change.before.name}`,
      reason: "Owner's 2026-10-09 Brand New, Preloved and Bundle Deals structure",
      requestId,
      at,
    });
  }
});
console.log(JSON.stringify({ applied: true, changed: preview.length }));
