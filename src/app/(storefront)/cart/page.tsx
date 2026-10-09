"use client";

import Link from "next/link";
import { BookCover } from "@/components/storefront/book-cover";
import { useCart } from "@/components/storefront/cart-context";
import { formatGhs } from "@/lib/contracts/catalog";
import { stockBooks } from "@/lib/stock-catalog";

export default function CartPage() {
  const { lines, setQuantity, remove } = useCart();
  const entries = lines.flatMap((line) => {
    const book = stockBooks.find((item) => item.variant.sku === line.sku);
    return book ? [{ book, quantity: line.quantity }] : [];
  });
  const subtotal = entries.reduce((sum, { book, quantity }) => sum + book.variant.pricePesewas * quantity, 0);

  return <main className="interior-page shell"><p className="eyebrow">Your order</p><div className="interior-heading"><div><h1>Your bag</h1><p>{entries.length ? "Review the books in your bag." : "There are no books in your bag yet."}</p></div><span className="preview-pill">Store preview</span></div>
    {!entries.length ? <div className="empty-state"><h2>Your bag is empty.</h2><p>Our online catalogue will open when the real stock is ready. Ask us about a product on WhatsApp in the meantime.</p><Link className="button button-dark" href="/contact">Contact the bookshop ↗</Link></div> : <div className="cart-layout"><div className="cart-lines">{entries.map(({ book, quantity }) => <article className="cart-line" key={book.variant.sku}><Link className="cart-cover" href={`/books/${book.slug}`}><BookCover book={book}/></Link><div className="cart-line-body"><p className="product-type">{book.label} · {book.variant.format}</p><h2><Link href={`/books/${book.slug}`}>{book.title}</Link></h2><p>by {book.author}</p><button className="remove-link" type="button" onClick={() => remove(book.variant.sku)}>Remove</button></div><div className="cart-line-controls"><strong>{formatGhs(book.variant.pricePesewas * quantity)}</strong><div className="quantity-control"><button type="button" onClick={() => setQuantity(book.variant.sku, quantity - 1)} aria-label={`Remove one ${book.title}`}>−</button><span>{quantity}</span><button type="button" onClick={() => setQuantity(book.variant.sku, quantity + 1)} disabled={quantity >= book.variant.available} aria-label={`Add one ${book.title}`}>+</button></div></div></article>)}</div><aside className="order-summary"><h2>Order summary</h2><div><span>Books</span><strong>{formatGhs(subtotal)}</strong></div><div><span>Delivery</span><span>Calculated after destination</span></div><div className="summary-total"><span>Subtotal</span><strong>{formatGhs(subtotal)}</strong></div><Link className="button button-dark summary-button" href="/checkout">Continue to checkout ↗</Link><p>Preview only. No payment can be made.</p></aside></div>}
  </main>;
}
