import Link from "next/link";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { BookCover } from "@/components/storefront/book-cover";
import { formatGhs, type PublicBook } from "@/lib/contracts/catalog";

export function BookCard({ book }: { book: PublicBook }) {
  return <article className="product-card">
    <Link className="product-image" href={`/books/${book.slug}`} aria-label={`View ${book.title}`}><BookCover book={book}/><span className="product-tag">{book.label.toUpperCase()}</span></Link>
    <div className="product-details"><p className="product-type">{book.label} · {book.variant.format}</p><h3><Link href={`/books/${book.slug}`}>{book.title}</Link></h3>{book.author ? <p className="product-author">by {book.author}</p> : null}<div className="product-bottom"><strong>{formatGhs(book.variant.pricePesewas)}</strong><AddToCart sku={book.variant.sku} compact/></div></div>
  </article>;
}
