import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";
import heroArtwork from "../../../public/brand/bookish-hero-editorial.webp";

const categories = [
  { slug: "picture-books", name: "Picture books", caption: "Bright pages for little ones" },
  { slug: "storybooks", name: "Storybooks", caption: "For growing readers" },
  { slug: "learning", name: "Learning resources", caption: "Workbooks, flashcards and more" },
  { slug: "puzzles", name: "Puzzles", caption: "Piece by piece, mind by mind" },
  { slug: "games", name: "Educational games", caption: "Play that teaches" },
] as const;

export default function HomePage() {
  return <main id="top" className="home-page">
    <section className="hero hero-real home-hero shell" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow"><span className="home-eyebrow-mark" aria-hidden="true"/>Children’s books & learning resources · Kumasi, Ghana</p>
        <h1 id="hero-heading">Where little minds <span>love to learn.</span></h1>
        <p className="hero-intro">Children’s books, puzzles, educational games and learning resources for curious kids. Our online shelves are taking shape. Looking for something? We’ll check what we have.</p>
        <div className="hero-actions"><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">Ask us on WhatsApp <span aria-hidden="true">↗</span></a><Link className="text-link" href="#categories">Browse the shelves <span aria-hidden="true">↓</span></Link></div>
        <div className="hero-note"><span className="hero-note-rule" aria-hidden="true"/>{bookishBrand.tagline}</div>
      </div>
      <div className="hero-art-panel"><Image src={heroArtwork} alt="Illustration of an open book with colourful paper shapes" fill sizes="(max-width: 900px) 100vw, 46vw" preload/><div className="hero-art-caption"><span>For curious young minds</span><strong>Read, play, learn.</strong></div></div>
    </section>

    <div className="benefit-strip"><div className="shell benefit-inner"><span>Based in Kumasi</span><span>Books, puzzles & games for kids</span><span>Nationwide delivery planned</span><span>Message us to check stock</span></div></div>

    <section className="categories shell section" id="categories" aria-labelledby="categories-heading"><div className="section-heading-row"><div><p className="eyebrow">Browse the shelves</p><h2 id="categories-heading">What are you looking for?</h2></div><Link className="section-link" href="/shop">View the shop <span aria-hidden="true">↗</span></Link></div><div className="category-grid">{categories.map((category, index) => <Link className={`category-card category-real category-${category.slug}`} href={`/shop?category=${category.slug}`} key={category.slug}><span className="category-index">0{index + 1}</span><span className="category-name">{category.name} <b aria-hidden="true">↗</b></span><span className="category-caption">{category.caption}</span></Link>)}</div></section>

    <section className="shelf section" id="shop" aria-labelledby="shelf-heading"><div className="shell shelf-pending"><div><p className="eyebrow">Our online shop</p><h2 id="shelf-heading">We’re adding our products online.</h2><p>Each listing will show a real photo, the price and availability. For now, tell us what you need and we’ll check our stock.</p><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> Check stock on WhatsApp</a></div><aside className="shelf-help"><h3>Looking for something specific?</h3><p>Send us a title, a child’s age or a photo of the item. We’ll check what we have and reply on WhatsApp.</p></aside></div></section>

    <section className="ghana-feature ghana-real shell" id="ghanaian" aria-labelledby="ghana-heading"><div className="ghana-copy"><p className="eyebrow">Ghanaian stories</p><h2 id="ghana-heading">Stories from close to home.</h2><p>Looking for children’s books by Ghanaian authors? Tell us what you need and we’ll check our shelves.</p><a className="button button-light" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">Ask about Ghanaian stories <span aria-hidden="true">↗</span></a></div><div className="ghana-detail"><span>Bookish Delight GH</span><strong>Kumasi, Ghana</strong><p>Children’s books & learning resources.</p></div></section>

    <section className="bottom-story shell section" id="about"><div><p className="eyebrow">About us</p><h2>Learning made delightful, from Kumasi.</h2></div><div className="bottom-story-copy"><p>We help parents, teachers and schools find books, puzzles and educational games children enjoy. Tell us a child’s age or what they’re learning and we’ll suggest what’s available.</p><Link className="text-link" href="/contact">Find us in Kumasi <span aria-hidden="true">↗</span></Link></div></section>

    <section className="ask-banner shell"><div><p className="eyebrow">Need something particular?</p><h2>We can check our shelves.</h2><p>Send a title, a child’s age or a photo to our WhatsApp number and we’ll let you know.</p></div><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a></section>
  </main>;
}
