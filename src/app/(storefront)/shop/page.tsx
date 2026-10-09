import type { Metadata } from "next";
import Link from "next/link";
import { BookCard } from "@/components/storefront/book-card";
import type { BookCategory } from "@/lib/contracts/catalog";
import { getPublicCatalog } from "@/lib/storefront/public-catalog";

export const metadata: Metadata = { title: "Shop | Bookish Delight" };

const filters: { label: string; value: BookCategory | "all" }[] = [
  { label: "All", value: "all" }, { label: "Picture books", value: "picture-books" }, { label: "Storybooks", value: "storybooks" }, { label: "Learning resources", value: "learning" }, { label: "Puzzles", value: "puzzles" }, { label: "Games", value: "games" }, { label: "Ghanaian stories", value: "ghanaian" },
];

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q = "", category = "all" } = await searchParams;
  const query = q.trim().toLowerCase();
  const catalog = await getPublicCatalog();
  const books = catalog.filter((book) => {
    const categoryMatch = category === "all" || book.categories.includes(category);
    const queryMatch = !query || [book.title, book.author, book.label, book.variant.isbn || ""].some((field) => field.toLowerCase().includes(query));
    return categoryMatch && queryMatch;
  });
  return <main className="interior-page shell"><p className="eyebrow">Bookish Delight GH</p><div className="interior-heading"><div><h1>Browse the shop</h1><p>Children’s books, puzzles, educational games and learning resources we have in stock.</p></div>{catalog.length ? null : <span className="preview-pill">Catalogue coming soon</span>}</div>
    <form className="shop-search" action="/shop" role="search"><input type="search" name="q" defaultValue={q} placeholder="Search by title, author, or ISBN" aria-label="Search the shop"/><button type="submit">Search ↗</button></form>
    <div className="filter-row" aria-label="Shop categories">{filters.map((filter) => <Link className={filter.value === category ? "active" : ""} href={`/shop?category=${filter.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`} key={filter.value}>{filter.label}</Link>)}</div>
    <p className="results-count">{books.length} {books.length === 1 ? "item" : "items"} online</p>
    {books.length ? <div className="product-grid shop-grid">{books.map((book) => <BookCard book={book} key={book.id}/>)}</div> : catalog.length ? <div className="empty-state"><h2>No matches.</h2><p>Try another search or category, or message us and we’ll check our stock.</p><Link className="button button-dark" href="/shop">Show everything ↗</Link></div> : <div className="empty-state"><h2>Nothing listed online yet.</h2><p>We’re adding real products, photos and prices. Looking for something now? Message us and we’ll check our stock.</p><Link className="button button-dark" href="/contact">Ask about a product ↗</Link></div>}
  </main>;
}
