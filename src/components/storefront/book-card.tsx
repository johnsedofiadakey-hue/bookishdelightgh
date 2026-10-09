import Link from "next/link";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { BookCover } from "@/components/storefront/book-cover";
import { CONDITION_LABELS, formatGhs, savingPesewas, type PublicBook } from "@/lib/contracts/catalog";

export function BookCard({ book }: { book: PublicBook }) {
  return <article className="product-card">
    <Link className="product-image" href={`/books/${book.slug}`} aria-label={`View ${book.title}`}><BookCover book={book}/>{book.variant.available < 1 ? <span className="product-tag">SOLD OUT</span> : savingPesewas(book.variant) ? <span className="product-tag product-tag-saving">SAVE {formatGhs(savingPesewas(book.variant))}</span> : book.label ? <span className="product-tag">{book.label.toUpperCase()}</span> : null}</Link>
    <div className="product-details"><p className="product-type">{[book.label, book.variant.format].filter(Boolean).join(" · ")}</p>{book.conditions.length ? <p className="product-conditions">{book.conditions.map((condition) => <span key={condition} data-condition={condition}>{CONDITION_LABELS[condition]}</span>)}</p> : null}<h3><Link href={`/books/${book.slug}`}>{book.title}</Link></h3>{book.author ? <p className="product-author">by {book.author}</p> : null}<div className="product-bottom"><strong>{book.variants.length > 1 ? "From " : ""}{formatGhs(Math.min(...book.variants.map((variant) => variant.pricePesewas)))}</strong>{book.variants.length > 1 ? <Link className="add-circle choose-option" href={`/books/${book.slug}`} aria-label={`Choose an option for ${book.title}`}>›</Link> : <AddToCart sku={book.variant.sku} available={book.variant.available} compact/>}</div></div>
  </article>;
}
