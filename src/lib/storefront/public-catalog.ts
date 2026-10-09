import { connection } from "next/server";
import { getAdminStore } from "@/lib/admin/store";
import type { PublicBook } from "@/lib/contracts/catalog";
import { loadPublicCatalog } from "@/lib/storefront/catalog";

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
