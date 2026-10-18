import Image from "next/image";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpRightIcon, WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";
import { getPublicCategories } from "@/lib/storefront/public-catalog";
import heroArtwork from "../../../public/brand/bookish-hero-editorial.webp";



export default async function HomePage() {
  const categories = await getPublicCategories();
  return <main id="top" className="home-page">
    <section className="hero hero-real home-hero shell" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow"><span className="home-eyebrow-mark" aria-hidden="true"/>Children’s books & learning resources · Kumasi, Ghana</p>
        <h1 id="hero-heading">Where little minds <span>love to learn.</span></h1>
        <p className="hero-intro">New and preloved children’s books, learning materials and book bundles, from baby board books to teen novels. Can’t find what you want? Ask us and we’ll check.</p>
        <div className="hero-actions"><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">Ask us on WhatsApp <ArrowUpRightIcon/></a><Link className="text-link" href="#categories">Browse the shelves <ArrowDownIcon/></Link></div>
        <div className="hero-note"><span className="hero-note-rule" aria-hidden="true"/>{bookishBrand.tagline}</div>
      </div>
      <div className="hero-art-panel"><Image src={heroArtwork} alt="Illustration of an open book with colourful paper shapes" fill sizes="(max-width: 900px) 100vw, 46vw" preload/><div className="hero-art-caption"><span>For curious young minds</span><strong>Read, play, learn.</strong></div></div>
    </section>

    <div className="benefit-strip"><div className="shell benefit-inner"><span>Based in Kumasi</span><span>Brand new &amp; preloved books</span><span>Delivery across Ghana coming soon</span><span>Message us to ask what’s in stock</span></div></div>

    <section className="categories shell section" id="categories" aria-labelledby="categories-heading"><div className="section-heading-row"><div><p className="eyebrow">Browse the shelves</p><h2 id="categories-heading">What would you like?</h2></div><Link className="section-link" href="/shop">View the shop <ArrowUpRightIcon/></Link></div><div className="condition-entry" aria-label="Shop by condition"><Link className="condition-card condition-new" href="/shop?condition=new"><strong>Brand new</strong><span>New copies that have never been read</span><b aria-hidden="true"><ArrowUpRightIcon/></b></Link><Link className="condition-card condition-preloved" href="/shop?condition=preloved"><strong>Preloved</strong><span>Used, but in good shape · lower prices</span><b aria-hidden="true"><ArrowUpRightIcon/></b></Link><Link className="condition-card condition-bundles" href="/shop?category=bundles"><strong>Bundle deals</strong><span>Sets of books that cost less together</span><b aria-hidden="true"><ArrowUpRightIcon/></b></Link></div><div className="category-grid">{categories.map((category, index) => <Link className={`category-card category-real category-tone-${index % 6}`} href={`/shop?category=${category.slug}`} key={category.slug}><span className="category-index">{String(index + 1).padStart(2, "0")}</span><span className="category-name">{category.name} <b aria-hidden="true"><ArrowUpRightIcon/></b></span>{category.caption ? <span className="category-caption">{category.caption}</span> : null}</Link>)}</div></section>

    <section className="shelf section" id="shop" aria-labelledby="shelf-heading"><div className="shell shelf-pending"><div><p className="eyebrow">Our online shop</p><h2 id="shelf-heading">We’re still putting our books online.</h2><p>Each book will have a real photo, a price and whether it’s in stock. For now, tell us what you need and we’ll check for you.</p><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> Check stock on WhatsApp</a></div><aside className="shelf-help"><h3>Looking for something specific?</h3><p>Send us a book title, a child’s age or a photo. We’ll check and reply on WhatsApp.</p></aside></div></section>

    <section className="ghana-feature ghana-real shell" id="preloved" aria-labelledby="preloved-heading"><div className="ghana-copy"><p className="eyebrow">Preloved books</p><h2 id="preloved-heading">Good used books for less.</h2><p>We check every page of our preloved books and mark each one Like new, Very good or Good. You know what you’re getting, and you pay less.</p><Link className="button button-light" href="/shop?condition=preloved">Shop preloved <ArrowUpRightIcon/></Link></div><div className="ghana-detail"><span>Bookish Delight GH</span><strong>Like new · Very good · Good</strong><p>Each book page tells you what its grade means.</p></div></section>

    <section className="bottom-story shell section" id="about"><div><p className="eyebrow">About us</p><h2>A children’s bookshop in Kumasi.</h2></div><div className="bottom-story-copy"><p>We help parents, teachers and schools find new and preloved books that children enjoy, from board books to teen novels. We also sell learning materials and Christian books. Tell us a child’s age or what they are learning, and we’ll suggest books we have.</p><Link className="text-link" href="/contact">Find us in Kumasi <ArrowUpRightIcon/></Link></div></section>

    <section className="ask-banner shell"><div><p className="eyebrow">Can’t find what you need?</p><h2>Ask us and we’ll check.</h2><p>Send a book title, a child’s age or a photo to our WhatsApp and we’ll let you know.</p></div><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a></section>
  </main>;
}
