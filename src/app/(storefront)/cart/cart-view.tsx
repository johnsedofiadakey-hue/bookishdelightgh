"use client";

import Link from "next/link";
import { BookCover } from "@/components/storefront/book-cover";
import { useCart } from "@/components/storefront/cart-context";
import { formatGhs, type PublicBook } from "@/lib/contracts/catalog";

export function CartView({ catalog }: { catalog: PublicBook[] }) {
  const { lines, setQuantity, remove, loaded } = useCart();
  const entries = lines.flatMap((line) => {
    for (const book of catalog) {
      const variant = book.variants.find((item) => item.sku === line.sku);
      if (variant) return [{ book, variant, quantity: line.quantity }];
    }
    return [];
  });
  const unavailable = lines.length - entries.length;
  const shortStock = entries.filter(({ variant, quantity }) => quantity > variant.available);
  const subtotal = entries.reduce((sum, { variant, quantity }) => sum + variant.pricePesewas * quantity, 0);
  const canCheckout = entries.length > 0 && shortStock.length === 0;

  return <main className="interior-page shell"><p className="eyebrow">Your order</p><div className="interior-heading"><div><h1>Your bag</h1><p>{!loaded ? "Loading your bag…" : entries.length ? "Review your items before checkout." : "There’s nothing in your bag yet."}</p></div></div>
    {unavailable > 0 ? <p className="cart-alert">{unavailable === 1 ? "One item in your bag is" : `${unavailable} items in your bag are`} no longer available and won’t be included.</p> : null}
    {shortStock.length ? <p className="cart-alert">Stock has changed for {shortStock.map(({ book }) => book.title).join(", ")}. Lower the quantity to continue.</p> : null}
    {loaded && !entries.length ? <div className="empty-state"><h2>Your bag is empty.</h2><p>Browse our brand new and preloved books, or message us on WhatsApp and we’ll help you choose.</p><Link className="button button-dark" href="/shop">Browse the shop ↗</Link></div> : null}
    {entries.length ? <div className="cart-layout"><div className="cart-lines">{entries.map(({ book, variant, quantity }) => <article className="cart-line" key={variant.sku}><Link className="cart-cover" href={`/books/${book.slug}`}><BookCover book={book}/></Link><div className="cart-line-body"><p className="product-type">{[book.label, variant.label].filter(Boolean).join(" · ")}</p><h2><Link href={`/books/${book.slug}`}>{book.title}</Link></h2>{book.author ? <p>by {book.author}</p> : null}{variant.available < 1 ? <p className="cart-line-warning">Out of stock</p> : quantity > variant.available ? <p className="cart-line-warning">Only {variant.available} available</p> : null}<button className="remove-link" type="button" onClick={() => remove(variant.sku)}>Remove</button></div><div className="cart-line-controls"><strong>{formatGhs(variant.pricePesewas * quantity)}</strong><div className="quantity-control"><button type="button" onClick={() => setQuantity(variant.sku, quantity - 1, Math.max(variant.available, quantity - 1))} aria-label={`Remove one ${book.title}`}>−</button><span>{quantity}</span><button type="button" onClick={() => setQuantity(variant.sku, quantity + 1, variant.available)} disabled={quantity >= variant.available} aria-label={`Add one ${book.title}`}>+</button></div></div></article>)}</div>
      <aside className="order-summary"><h2>Order summary</h2><div><span>Items</span><strong>{formatGhs(subtotal)}</strong></div><div><span>Delivery</span><span>Calculated at checkout</span></div><div className="summary-total"><span>Subtotal</span><strong>{formatGhs(subtotal)}</strong></div>{canCheckout ? <Link className="button button-dark summary-button" href="/checkout">Continue to checkout ↗</Link> : <button className="button button-dark summary-button" type="button" disabled>Fix your bag to continue</button>}<p>Prices and stock are checked again before payment.</p></aside></div> : null}
  </main>;
}
