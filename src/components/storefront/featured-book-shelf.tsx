import Link from "next/link";
import { BookCover } from "@/components/storefront/book-cover";
import { formatGhs, type PublicBook } from "@/lib/contracts/catalog";

/** Published, in-stock titles with the business's real cover photos only. */
export function FeaturedBookShelf({ books }: { books: PublicBook[] }) {
  if (!books.length) return null;

  return <section className="real-book-shelf section" id="shop" aria-labelledby="real-book-shelf-heading">
    <div className="shell">
      <div className="real-book-shelf-heading">
        <div><p className="eyebrow">From our actual shelves</p><h2 id="real-book-shelf-heading">A few books to meet.</h2><p>Real covers from the books we have listed online.</p></div>
        <Link href="/shop">Browse the shop <span aria-hidden="true">↗</span></Link>
      </div>
      <p className="real-book-swipe">Swipe to meet the books <span aria-hidden="true">→</span></p>
      <ul className="real-book-track">
        {books.map((book) => <li key={book.id}>
          <Link href={`/books/${book.slug}?sku=${encodeURIComponent(book.variant.sku)}`} aria-label={`View ${book.title}`}>
            <span className="real-book-photo"><BookCover book={book}/></span>
            <span className="real-book-meta"><small>{book.label}</small><strong>{book.title}</strong><span>{formatGhs(book.variant.pricePesewas)}</span></span>
          </Link>
        </li>)}
      </ul>
    </div>
  </section>;
}
