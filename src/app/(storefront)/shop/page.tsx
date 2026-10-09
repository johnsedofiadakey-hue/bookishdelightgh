import type { Metadata } from "next";
import Link from "next/link";
import { BookCard } from "@/components/storefront/book-card";
import { CONDITION_LABELS, ITEM_CONDITIONS, type ItemCondition, type PublicBook } from "@/lib/contracts/catalog";
import { getPublicCatalog, getPublicCategories } from "@/lib/storefront/public-catalog";

export const metadata: Metadata = { title: "Shop | Bookish Delight" };

function shopHref(params: { category?: string; condition?: string; q?: string }): string {
  const query = new URLSearchParams();
  if (params.category && params.category !== "all") query.set("category", params.category);
  if (params.condition && params.condition !== "all") query.set("condition", params.condition);
  if (params.q) query.set("q", params.q);
  const text = query.toString();
  return text ? `/shop?${text}` : "/shop";
}

/** Show the option that matches the chosen condition on the card. */
function forCondition(book: PublicBook, condition: ItemCondition | "all"): PublicBook {
  if (condition === "all") return book;
  const options = book.variants.filter((variant) => variant.condition === condition);
  return { ...book, variant: options.find((variant) => variant.available > 0) ?? options[0] ?? book.variant };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; condition?: string }> }) {
  const { q = "", category = "all", condition: rawCondition = "all" } = await searchParams;
  const condition: ItemCondition | "all" = (ITEM_CONDITIONS as readonly string[]).includes(rawCondition) ? (rawCondition as ItemCondition) : "all";
  const query = q.trim().toLowerCase();
  const [catalog, categories] = await Promise.all([getPublicCatalog(), getPublicCategories()]);
  const books = catalog
    .filter((book) => {
      const categoryMatch = category === "all" || book.categories.includes(category);
      const conditionMatch = condition === "all" || book.conditions.includes(condition);
      const queryMatch = !query || [book.title, book.author, book.label, ...book.variants.map((variant) => variant.isbn || "")].some((field) => field.toLowerCase().includes(query));
      return categoryMatch && conditionMatch && queryMatch;
    })
    .map((book) => forCondition(book, condition));
  const shelf = categories.find((item) => item.slug === category);
  const heading = shelf ? shelf.name : condition === "preloved" ? "Preloved books" : condition === "new" ? "Brand new books" : "Browse the shop";
  const intro = shelf?.caption ?? (condition === "preloved" ? "Gently used books, checked and graded, at friendlier prices." : "Brand new and preloved children’s books, educational resources and bundle deals.");
  return <main className="interior-page shell"><p className="eyebrow">Bookish Delight GH</p><div className="interior-heading"><div><h1>{heading}</h1><p>{intro}</p></div>{catalog.length ? null : <span className="preview-pill">Catalogue coming soon</span>}</div>
    <form className="shop-search" action="/shop" role="search">{category !== "all" ? <input type="hidden" name="category" value={category}/> : null}{condition !== "all" ? <input type="hidden" name="condition" value={condition}/> : null}<input type="search" name="q" defaultValue={q} placeholder="Search by title, author, or ISBN" aria-label="Search the shop"/><button type="submit">Search ↗</button></form>
    <div className="filter-row" aria-label="Condition">{(["all", ...ITEM_CONDITIONS] as const).map((value) => <Link className={value === condition ? "active" : ""} href={shopHref({ category, condition: value, q })} key={value}>{value === "all" ? "New & preloved" : CONDITION_LABELS[value]}</Link>)}</div>
    <div className="filter-row" aria-label="Shop shelves">{[{ slug: "all", name: "All shelves" }, ...categories].map((item) => <Link className={item.slug === category ? "active" : ""} href={shopHref({ category: item.slug, condition, q })} key={item.slug}>{item.name}</Link>)}</div>
    <p className="results-count">{books.length} {books.length === 1 ? "item" : "items"} online</p>
    {books.length ? <div className="product-grid shop-grid">{books.map((book) => <BookCard book={book} key={book.id}/>)}</div> : catalog.length ? <div className="empty-state"><h2>No matches.</h2><p>Try another search, shelf or condition, or message us and we’ll check our stock.</p><Link className="button button-dark" href="/shop">Show everything ↗</Link></div> : <div className="empty-state"><h2>Nothing listed online yet.</h2><p>We’re adding real products, photos and prices. Looking for something now? Message us and we’ll check our stock.</p><Link className="button button-dark" href="/contact">Ask about a product ↗</Link></div>}
  </main>;
}
