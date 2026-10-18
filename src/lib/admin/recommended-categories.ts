/**
 * Bookish Delight's shop shelves, agreed with the owner (2026-10-09).
 *
 * Shelves describe what kind of book something is. Whether a copy is brand
 * new or preloved is NOT a shelf: it is set on each variant (Catalogue →
 * book → variant → Condition), so one title can be sold both ways from one
 * page. Age is also separate (the book's age band).
 *
 * The website reads shelves from Admin → Categories; this list is what the
 * "Add the recommended categories" button creates, and what the site shows
 * until any category exists.
 */
export const RECOMMENDED_CATEGORIES = [
  { name: "Baby & Toddler Books", slug: "baby-toddler", caption: "Board, touch-and-feel and cloth books · 0–3", order: 1 },
  { name: "Phonics & Early Readers", slug: "early-readers", caption: "Phonics sets and first reading books · 4–7", order: 2 },
  { name: "Story Collections", slug: "story-collections", caption: "Treasuries and bedtime story books", order: 3 },
  { name: "Chapter Books", slug: "chapter-books", caption: "First chapter series for independent readers", order: 4 },
  { name: "Pre-Teens & Teens Novels", slug: "teens", caption: "Novels for readers 10 and up", order: 5 },
  { name: "Activity Books", slug: "activity-books", caption: "Sticker, colouring and wipe-clean books", order: 6 },
  { name: "Educational Resources", slug: "educational-resources", caption: "Workbooks, flashcards and practice books", order: 7 },
  { name: "Educational & Reference Books", slug: "reference", caption: "Dictionaries, atlases and encyclopedias", order: 8 },
  { name: "Christian Literature", slug: "christian", caption: "Children’s Bibles, devotionals and Bible stories", order: 9 },
  { name: "Bundle Deals", slug: "bundles", caption: "Hand-picked sets at a discount", order: 10 },
] as const;

export const STOREFRONT_CATEGORY_SLUGS: ReadonlySet<string> = new Set(RECOMMENDED_CATEGORIES.map((category) => category.slug));

/** Shelves from the earlier storefront design that the business does not sell. Staff are prompted to hide them. */
export const RETIRED_CATEGORY_SLUGS: ReadonlySet<string> = new Set(["picture-books", "storybooks", "learning", "puzzles", "games", "ghanaian", "fiction", "children", "nonfiction"]);
