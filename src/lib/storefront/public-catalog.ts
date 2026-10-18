import { connection } from "next/server";
import { getAdminStore } from "@/lib/admin/store";
import { RECOMMENDED_CATEGORIES } from "@/lib/admin/recommended-categories";
import type { PublicBook, PublicCategory } from "@/lib/contracts/catalog";
import { loadPublicCatalog, loadPublicCategories } from "@/lib/storefront/catalog";

/** Catalogue for storefront pages. Returns an empty list if the store is unreachable. */
export async function getPublicCatalog(): Promise<PublicBook[]> {
  // Stock and prices change constantly: always read at request time, never at build.
  await connection();
  try {
    return await loadPublicCatalog(getAdminStore());
  } catch (error) {
    console.error("[storefront catalogue]", error);
    return [];
  }
}

/** Shop shelves. Falls back to the recommended list if the store is unreachable. */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  await connection();
  try {
    return await loadPublicCategories(getAdminStore());
  } catch (error) {
    console.error("[storefront categories]", error);
    return RECOMMENDED_CATEGORIES.map(({ slug, name, caption }) => ({ slug, name, caption }));
  }
}
