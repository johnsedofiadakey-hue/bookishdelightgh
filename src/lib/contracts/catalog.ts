export type BookFormat =
  | "Paperback"
  | "Hardcover"
  | "Board book"
  | "Box set"
  | "Spiral bound"
  | "Activity book"
  | "Workbook"
  | "Flashcards"
  | "Bundle";

/**
 * Brand new stock, a preloved (second-hand) copy with a condition grade, or,
 * for bundles only, a mix of both.
 */
export type ItemCondition = "new" | "preloved" | "mixed";
export type PrelovedGrade = "like_new" | "very_good" | "good";

/** Conditions a single item can have; also the shop's condition filter. */
export const ITEM_CONDITIONS: readonly ItemCondition[] = ["new", "preloved"];
/** Conditions a bundle can have. */
export const BUNDLE_CONDITIONS: readonly ItemCondition[] = ["new", "preloved", "mixed"];
export const PRELOVED_GRADES: readonly PrelovedGrade[] = ["like_new", "very_good", "good"];

export const CONDITION_LABELS: Record<ItemCondition, string> = { new: "Brand new", preloved: "Preloved", mixed: "Mixed: new & preloved" };
export const GRADE_LABELS: Record<PrelovedGrade, string> = { like_new: "Like new", very_good: "Very good", good: "Good" };
export const GRADE_DESCRIPTIONS: Record<PrelovedGrade, string> = {
  like_new: "Read once or twice. No marks, creases or loose pages.",
  very_good: "Light signs of reading, such as a soft spine or slightly worn corners.",
  good: "Clearly read and loved. May have a name inside, small marks or worn edges. Every page is there.",
};

/** "Brand new" or "Preloved · Very good". Records written before conditions existed count as brand new. */
export function conditionLabel(condition: ItemCondition | undefined, grade?: PrelovedGrade): string {
  if (condition === "mixed") return CONDITION_LABELS.mixed;
  if (condition !== "preloved") return CONDITION_LABELS.new;
  return grade ? `${CONDITION_LABELS.preloved} · ${GRADE_LABELS[grade]}` : CONDITION_LABELS.preloved;
}

/** One-line option name used on cards, the bag, checkout, order slips and SMS: "Paperback · Preloved · Very good". */
export function optionLabel(format: string, condition: ItemCondition | undefined, grade?: PrelovedGrade): string {
  return `${format} · ${conditionLabel(condition, grade)}`;
}

export interface BookVariant {
  sku: string;
  format: BookFormat;
  condition: ItemCondition;
  conditionGrade?: PrelovedGrade;
  /** Staff note about this copy's condition, e.g. "Name written inside the cover". */
  conditionNote?: string;
  /** Format plus condition, ready to display. */
  label: string;
  pricePesewas: number;
  /** "Worth" price if bought separately; shown as a saving when above the price. */
  compareAtPesewas?: number;
  /** Bundles only: what's inside. */
  bundleItems?: PublicBundleItem[];
  available: number;
  isbn?: string;
}

export interface PublicBundleItem {
  title: string;
  quantity: number;
  /** e.g. "Paperback · Preloved · Very good" when the item is a listed SKU. */
  detail?: string;
}

/** Saving shown to customers, or 0. */
export function savingPesewas(variant: Pick<BookVariant, "pricePesewas" | "compareAtPesewas">): number {
  return variant.compareAtPesewas && variant.compareAtPesewas > variant.pricePesewas ? variant.compareAtPesewas - variant.pricePesewas : 0;
}

/** A shop shelf, managed in Admin → Categories. */
export interface PublicCategory {
  slug: string;
  name: string;
  caption?: string;
}

export interface PublicBook {
  id: string;
  slug: string;
  title: string;
  author: string;
  /** Category slugs, as managed in Admin → Categories. */
  categories: string[];
  /** Conditions available across this item's options. */
  conditions: ItemCondition[];
  /** Short card label, e.g. "Ages 4–7". */
  label: string;
  description: string;
  coverImageUrl?: string;
  coverAlt?: string;
  /** Default variant: the cheapest one in stock, else the cheapest. */
  variant: BookVariant;
  /** Every active variant, cheapest first. */
  variants: BookVariant[];
}

export function formatGhs(pesewas: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(pesewas / 100);
}
