import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { BookCover } from "@/components/storefront/book-cover";
import { BookCard } from "@/components/storefront/book-card";
import { formatGhs } from "@/lib/contracts/catalog";
import { getStockBooks } from "@/lib/stock-catalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const book = getStockBooks().find((item) => item.slug === slug);
  if (!book) return { title: "Book not found | Bookish Delight GH" };
  const title = `${book.title} | Bookish Delight GH`;
  return {
    title,
    description: book.description,
    openGraph: {
      title,
      description: book.description,
      siteName: "Bookish Delight GH",
      locale: "en_GH",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Bookish Delight GH logo and brand message" }],
    },
    twitter: { card: "summary_large_image", title, description: book.description, images: ["/opengraph-image"] },
  };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = getStockBooks();
  const book = all.find((item) => item.slug === slug);
  if (!book) notFound();
  const related = all.filter((item) => item.id !== book.id).slice(0, 3);
  return <main className="interior-page shell"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/shop">Shop</Link><span>›</span>{book.title}</nav><div className="book-detail"><div className="book-detail-art"><BookCover book={book}/></div><div className="book-detail-info"><p className="eyebrow">{book.label}</p><h1>{book.title}</h1>{book.author ? <p className="detail-author">by {book.author}</p> : null}<p className="detail-price">{formatGhs(book.variant.pricePesewas)}</p><p className="detail-description">{book.description}</p><dl className="detail-facts"><div><dt>Format</dt><dd>{book.variant.format}</dd></div><div><dt>Availability</dt><dd>{book.variant.available > 0 ? "In stock" : "Out of stock"}</dd></div><div><dt>Delivery</dt><dd>Nationwide rates shown at checkout when available</dd></div></dl><AddToCart sku={book.variant.sku}/><p className="detail-note">Online ordering will open after stock and delivery are verified.</p></div></div><section className="related-books"><p className="eyebrow">More books</p><h2>You may also like</h2><div className="product-grid">{related.map((item) => <BookCard book={item} key={item.id}/>)}</div></section></main>;
}
