import { BUNDLE_CONDITIONS, type ItemCondition, type PublicBook } from "@/lib/contracts/catalog";

/** The public shop uses the same placement as the admin stock-option form. */
export function filterShopBooks(catalog: PublicBook[], category: string, condition: ItemCondition | "all", search = ""): PublicBook[] {
  const query = search.trim().toLowerCase();
  const bundleView = category === "bundles";

  return catalog.flatMap((book) => {
    if (category !== "all" && !book.categories.includes(category)) return [];
    const variants = book.variants.filter((variant) => {
      if (bundleView) return variant.format === "Bundle";
      if (category !== "all" || condition !== "all") {
        return variant.format !== "Bundle" && (condition === "all" || variant.condition === condition);
      }
      return true;
    });
    if (!variants.length) return [];
    if (query && ![book.title, book.author, book.label, ...variants.map((variant) => variant.isbn ?? "")].some((field) => field.toLowerCase().includes(query))) return [];
    return [{
      ...book,
      variants,
      variant: variants.find((variant) => variant.available > 0) ?? variants[0],
      conditions: BUNDLE_CONDITIONS.filter((value) => variants.some((variant) => variant.condition === value)),
    }];
  }).sort((left, right) => Number(right.variant.available > 0) - Number(left.variant.available > 0) || left.title.localeCompare(right.title));
}
