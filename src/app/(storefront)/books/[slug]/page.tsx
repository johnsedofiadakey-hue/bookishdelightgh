import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/storefront/book-cover";
import { BookCard } from "@/components/storefront/book-card";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { getPublicCatalog } from "@/lib/storefront/public-catalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const book = (await getPublicCatalog()).find((item) => item.slug === slug);
  if (!book) return { title: "Not found | Bookish Delight GH" };
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
  const all = await getPublicCatalog();
  const book = all.find((item) => item.slug === slug);
  if (!book) notFound();
  const related = all.filter((item) => item.id !== book.id && item.categories.some((slug) => book.categories.includes(slug))).slice(0, 3);
  return <main className="interior-page shell"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/shop">Shop</Link><span>›</span>{book.title}</nav><div className="book-detail"><div className="book-detail-art"><BookCover book={book}/></div><div className="book-detail-info"><p className="eyebrow">{book.label}</p><h1>{book.title}</h1>{book.author ? <p className="detail-author">by {book.author}</p> : null}<p className="detail-description">{book.description}</p><VariantPicker variants={book.variants} initialSku={book.variant.sku}/></div></div>{related.length ? <section className="related-books"><p className="eyebrow">More like this</p><h2>You may also like</h2><div className="product-grid">{related.map((item) => <BookCard book={item} key={item.id}/>)}</div></section> : null}</main>;
}
