"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { bool, idempotencyKey, optionalInt, runAction, text } from "@/lib/admin/actions";
import { saveCategory } from "@/lib/admin/ops/catalogue";
import { RECOMMENDED_CATEGORIES, RETIRED_CATEGORY_SLUGS } from "@/lib/admin/recommended-categories";

export async function saveCategoryAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("content.edit", async ({ store, ctx }) => {
    const id = text(form, "categoryId") || undefined;
    const { result } = await saveCategory(
      store,
      ctx,
      {
        id,
        name: text(form, "name"),
        slug: text(form, "slug") || undefined,
        caption: text(form, "caption") || undefined,
        order: optionalInt(form, "order") ?? 0,
        published: bool(form, "published"),
      },
      idempotencyKey(form),
    );
    return { message: id ? "Category saved." : "Category added. Assign products to it from the Catalogue.", data: { categoryId: result.categoryId } };
  });
}

/** Creates any of the website's recommended categories that do not exist yet. */
export async function addRecommendedCategoriesAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("content.edit", async ({ store, ctx }) => {
    const existing = new Set((await store.query("categories")).map((category) => category.slug));
    const missing = RECOMMENDED_CATEGORIES.filter((category) => !existing.has(category.slug));
    const base = idempotencyKey(form);
    for (const category of missing) {
      await saveCategory(store, ctx, { ...category, published: true }, `${base}-${category.slug}`.slice(0, 80));
    }
    return { message: missing.length ? `Added ${missing.length} categor${missing.length === 1 ? "y" : "ies"}: ${missing.map((category) => category.name).join(", ")}.` : "All recommended categories already exist." };
  });
}

/** Hides (never deletes) shelves from the earlier site design that the business does not sell. */
export async function hideRetiredCategoriesAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("content.edit", async ({ store, ctx }) => {
    const retired = (await store.query("categories")).filter((category) => category.published && RETIRED_CATEGORY_SLUGS.has(category.slug));
    const base = idempotencyKey(form);
    for (const category of retired) {
      await saveCategory(store, ctx, { id: category.id, name: category.name, slug: category.slug, caption: category.caption, order: category.order, published: false }, `${base}-hide-${category.slug}`.slice(0, 80));
    }
    return { message: retired.length ? `Hidden: ${retired.map((category) => category.name).join(", ")}. Their products stay in the shop; move them to the new shelves from the Catalogue.` : "No old shelves to hide." };
  });
}
