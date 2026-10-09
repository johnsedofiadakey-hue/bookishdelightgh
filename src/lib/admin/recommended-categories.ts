/**
 * Bookish Delight's shop shelves, agreed with the owner (2026-10-09).
 *
 * The seven book-type shelves apply to both Brand New and Preloved. A bundle
 * appears in Bundle Deals when its stock option has format Bundle. One title
 * can have separate new and preloved stock options on the same book page.
 *
 * The website reads shelves from Admin → Categories; this list is what the
 * "Add the recommended categories" button creates, and what the site shows
 * until any category exists.
 */
export const RECOMMENDED_CATEGORIES = [
  { name: "Baby & Toddler Books", slug: "baby-toddler", caption: "Board, touch-and-feel and cloth books · 0–3", order: 1 },
  { name: "Early Readers", slug: "early-readers", caption: "Phonics sets and first reading books · 4–7", order: 2 },
  { name: "Chapter Books", slug: "chapter-books", caption: "First chapter series for independent readers", order: 3 },
  { name: "Pre-Teens & Teens Novels", slug: "teens", caption: "Novels for readers 10 and up", order: 4 },
  { name: "Educational Resources", slug: "educational-resources", caption: "Workbooks, flashcards and practice books", order: 5 },
  { name: "Educational / Reference Books", slug: "reference", caption: "Dictionaries, atlases and encyclopedias", order: 6 },
  { name: "Christian Literature", slug: "christian", caption: "Children’s Bibles, devotionals and Bible stories", order: 7 },
  { name: "Bundle Deals", slug: "bundles", caption: "Sets of books and learning materials", order: 8 },
] as const;

export const STOREFRONT_CATEGORY_SLUGS: ReadonlySet<string> = new Set(RECOMMENDED_CATEGORIES.map((category) => category.slug));

/** Shelves from the earlier storefront design that the business does not sell. Staff are prompted to hide them. */
export const RETIRED_CATEGORY_SLUGS: ReadonlySet<string> = new Set(["picture-books", "storybooks", "story-collections", "activity-books", "learning", "puzzles", "games", "ghanaian", "fiction", "children", "nonfiction"]);
