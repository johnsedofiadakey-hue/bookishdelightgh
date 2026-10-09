import type { Metadata } from "next";
import Link from "next/link";
import { BookCard } from "@/components/storefront/book-card";
import { ITEM_CONDITIONS, type ItemCondition } from "@/lib/contracts/catalog";
import { getPublicCatalog, getPublicCategories } from "@/lib/storefront/public-catalog";
import { filterShopBooks } from "@/lib/storefront/shop-filter";

export const metadata: Metadata = { title: "Shop | Bookish Delight" };

function shopHref(params: { category?: string; condition?: string; q?: string }): string {
  const query = new URLSearchParams();
  if (params.category && params.category !== "all") query.set("category", params.category);
  if (params.condition && params.condition !== "all") query.set("condition", params.condition);
  if (params.q) query.set("q", params.q);
  const text = query.toString();
  return text ? `/shop?${text}` : "/shop";
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; condition?: string }> }) {
  const { q = "", category = "all", condition: rawCondition = "all" } = await searchParams;
  const bundleView = category === "bundles";
  const condition: ItemCondition | "all" = !bundleView && (ITEM_CONDITIONS as readonly string[]).includes(rawCondition) ? (rawCondition as ItemCondition) : "all";
  const [catalog, categories] = await Promise.all([getPublicCatalog(), getPublicCategories()]);
  const books = filterShopBooks(catalog, category, condition, q);
  const subjectCategories = categories.filter((item) => item.slug !== "bundles");
  const bundleCategory = categories.find((item) => item.slug === "bundles");
  const shelf = categories.find((item) => item.slug === category);
  const heading = bundleView ? "Bundle Deals" : shelf ? `${condition === "new" ? "Brand New · " : condition === "preloved" ? "Preloved · " : ""}${shelf.name}` : condition === "preloved" ? "Preloved books" : condition === "new" ? "Brand new books" : "Browse the shop";
  const intro = shelf?.caption ?? (condition === "preloved" ? "Gently used books, checked and graded, at friendlier prices." : "Brand new and preloved children’s books, educational resources and bundle deals.");
  return <main className="interior-page shell"><p className="eyebrow">Bookish Delight GH</p><div className="interior-heading"><div><h1>{heading}</h1><p>{intro}</p></div>{catalog.length ? null : <span className="preview-pill">Catalogue coming soon</span>}</div>
    <form className="shop-search" action="/shop" role="search">{category !== "all" ? <input type="hidden" name="category" value={category}/> : null}{condition !== "all" ? <input type="hidden" name="condition" value={condition}/> : null}<input type="search" name="q" defaultValue={q} placeholder="Search by title, author, or ISBN" aria-label="Search the shop"/><button type="submit">Search ↗</button></form>
    <div className="filter-row" aria-label="Main shop sections">
      <Link className={category === "all" && condition === "all" ? "active" : ""} href={shopHref({ q })}>Shop all</Link>
      <Link className={condition === "new" ? "active" : ""} href={shopHref({ category: bundleView ? "all" : category, condition: "new", q })}>Brand New</Link>
      <Link className={condition === "preloved" ? "active" : ""} href={shopHref({ category: bundleView ? "all" : category, condition: "preloved", q })}>Preloved</Link>
      {bundleCategory ? <Link className={bundleView ? "active" : ""} href={shopHref({ category: "bundles", q })}>Bundle Deals</Link> : null}
    </div>
    {!bundleView ? <div className="filter-row" aria-label="Book types">{[{ slug: "all", name: "All book types" }, ...subjectCategories].map((item) => <Link className={item.slug === category ? "active" : ""} href={shopHref({ category: item.slug, condition, q })} key={item.slug}>{item.name}</Link>)}</div> : null}
    <p className="results-count">{books.length} {books.length === 1 ? "item" : "items"} online</p>
    {books.length ? <div className="product-grid shop-grid">{books.map((book) => <BookCard book={book} key={book.id}/>)}</div> : catalog.length ? <div className="empty-state"><h2>No matches.</h2><p>Try another search, shelf or condition, or message us and we’ll check our stock.</p><Link className="button button-dark" href="/shop">Show everything ↗</Link></div> : <div className="empty-state"><h2>Nothing listed online yet.</h2><p>We’re adding real products, photos and prices. Looking for something now? Message us and we’ll check our stock.</p><Link className="button button-dark" href="/contact">Ask about a product ↗</Link></div>}
  </main>;
}
