import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";
import heroArtwork from "../../../public/brand/bookish-hero-editorial.webp";

const categories = [
  { slug: "fiction", name: "Fiction", caption: "Stories to settle into" },
  { slug: "children", name: "Children’s books", caption: "For young readers" },
  { slug: "nonfiction", name: "Nonfiction", caption: "Ideas and real lives" },
  { slug: "ghanaian", name: "Ghanaian reads", caption: "Voices close to home" },
  { slug: "learning", name: "Learning", caption: "Books for growing minds" },
] as const;

export default function HomePage() {
  return <main id="top" className="home-page">
    <section className="hero hero-real home-hero shell" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow"><span className="home-eyebrow-mark" aria-hidden="true"/>Books for every age · Kumasi, Ghana</p>
        <h1 id="hero-heading">Every good day has room for <span>a book.</span></h1>
        <p className="hero-intro">For little readers and lifelong ones, there’s always another story to discover. Our online shelves are taking shape. Have a title in mind? We’ll check what we have.</p>
        <div className="hero-actions"><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">Ask us about a book <span aria-hidden="true">↗</span></a><Link className="text-link" href="#categories">Browse by interest <span aria-hidden="true">↓</span></Link></div>
        <div className="hero-note"><span className="hero-note-rule" aria-hidden="true"/>{bookishBrand.tagline}</div>
      </div>
      <div className="hero-art-panel"><Image src={heroArtwork} alt="Illustration of an open book with colourful paper shapes" fill sizes="(max-width: 900px) 100vw, 46vw" preload/><div className="hero-art-caption"><span>For the curious at heart</span><strong>Open a book. See what happens.</strong></div></div>
    </section>

    <div className="benefit-strip"><div className="shell benefit-inner"><span>Based in Kumasi</span><span>Books for every age</span><span>Nationwide delivery planned</span><span>Message us about a title</span></div></div>

    <section className="categories shell section" id="categories" aria-labelledby="categories-heading"><div className="section-heading-row"><div><p className="eyebrow">Browse by interest</p><h2 id="categories-heading">What do you like to read?</h2></div><Link className="section-link" href="/shop">View the shop <span aria-hidden="true">↗</span></Link></div><div className="category-grid">{categories.map((category, index) => <Link className={`category-card category-real category-${category.slug}`} href={`/shop?category=${category.slug}`} key={category.slug}><span className="category-index">0{index + 1}</span><span className="category-name">{category.name} <b aria-hidden="true">↗</b></span><span className="category-caption">{category.caption}</span></Link>)}</div></section>

    <section className="shelf section" id="shop" aria-labelledby="shelf-heading"><div className="shell shelf-pending"><div><p className="eyebrow">Our online shop</p><h2 id="shelf-heading">We’re adding our books online.</h2><p>Each listing will show the actual cover, price and availability. For now, tell us the title you need and we’ll check our stock.</p><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> Check a book on WhatsApp</a></div><aside className="shelf-help"><h3>Looking for something specific?</h3><p>Send us the title, author or a photo of the cover. We’ll check what we have and reply on WhatsApp.</p></aside></div></section>

    <section className="ghana-feature ghana-real shell" id="ghanaian" aria-labelledby="ghana-heading"><div className="ghana-copy"><p className="eyebrow">Ghanaian books</p><h2 id="ghana-heading">Looking for a Ghanaian author?</h2><p>Tell us who you’re looking for. We’ll let you know which books we have on our shelves.</p><a className="button button-light" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">Ask about Ghanaian books <span aria-hidden="true">↗</span></a></div><div className="ghana-detail"><span>Bookish Delight GH</span><strong>Kumasi, Ghana</strong><p>Books for children and adults.</p></div></section>

    <section className="bottom-story shell section" id="about"><div><p className="eyebrow">About the bookshop</p><h2>Books for all ages, from Kumasi.</h2></div><div className="bottom-story-copy"><p>We help families and readers find books they’ll enjoy. Ask us about a title, an author or a reading age and we’ll check what’s available.</p><Link className="text-link" href="/contact">Find us in Kumasi <span aria-hidden="true">↗</span></Link></div></section>

    <section className="ask-banner shell"><div><p className="eyebrow">Need a particular book?</p><h2>We can check our shelves.</h2><p>Send the title or author to our WhatsApp number and we’ll let you know.</p></div><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a></section>
  </main>;
}
