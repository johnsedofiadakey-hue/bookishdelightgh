import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/storefront/icons";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";
import { getPublicCategories } from "@/lib/storefront/public-catalog";
import heroArtwork from "../../../public/brand/bookish-hero-editorial.webp";



export default async function HomePage() {
  const categories = await getPublicCategories();
  const showBundles = categories.some((category) => category.slug === "bundles");
  return <main id="top" className="home-page">
    <section className="hero hero-real home-hero shell" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow"><span className="home-eyebrow-mark" aria-hidden="true"/>Children’s books & learning resources · Kumasi, Ghana</p>
        <h1 id="hero-heading">Where little minds <span>love to learn.</span></h1>
        <p className="hero-intro">Brand new and preloved children’s books, educational resources and bundle deals, from first board books to teen novels. Looking for something? We’ll check what we have.</p>
        <div className="hero-actions"><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer">Ask us on WhatsApp <span aria-hidden="true">↗</span></a><Link className="text-link" href="#categories">Browse the shelves <span aria-hidden="true">↓</span></Link></div>
        <div className="hero-note"><span className="hero-note-rule" aria-hidden="true"/>{bookishBrand.tagline}</div>
      </div>
      <div className="hero-art-panel"><Image src={heroArtwork} alt="Illustration of an open book with colourful paper shapes" fill sizes="(max-width: 900px) 100vw, 46vw" preload/><div className="hero-art-caption"><span>For curious young minds</span><strong>Read, play, learn.</strong></div></div>
    </section>

    <div className="benefit-strip"><div className="shell benefit-inner"><span>Based in Kumasi</span><span>Brand new &amp; preloved books</span><span>Nationwide delivery planned</span><span>Message us to check stock</span></div></div>

    <section className="categories shell section" id="categories" aria-labelledby="categories-heading"><div className="section-heading-row"><div><p className="eyebrow">Browse the shelves</p><h2 id="categories-heading">What are you looking for?</h2></div><Link className="section-link" href="/shop">View the shop <span aria-hidden="true">↗</span></Link></div><div className="condition-entry" aria-label="Shop by condition"><Link className="condition-card condition-new" href="/shop?condition=new"><strong>Brand new</strong><span>Fresh copies, straight from the publisher</span><b aria-hidden="true">↗</b></Link><Link className="condition-card condition-preloved" href="/shop?condition=preloved"><strong>Preloved</strong><span>Gently used, checked and graded · friendlier prices</span><b aria-hidden="true">↗</b></Link>{showBundles ? <Link className="condition-card condition-bundles" href="/shop?category=bundles"><strong>Bundle deals</strong><span>Hand-picked sets at a discount</span><b aria-hidden="true">↗</b></Link> : null}</div><div className="category-grid">{categories.map((category, index) => <Link className={`category-card category-real category-tone-${index % 6}`} href={`/shop?category=${category.slug}`} key={category.slug}><span className="category-index">{String(index + 1).padStart(2, "0")}</span><span className="category-name">{category.name} <b aria-hidden="true">↗</b></span>{category.caption ? <span className="category-caption">{category.caption}</span> : null}</Link>)}</div></section>

    <section className="shelf section" id="shop" aria-labelledby="shelf-heading"><div className="shell shelf-pending"><div><p className="eyebrow">Our online shop</p><h2 id="shelf-heading">We’re adding our products online.</h2><p>Each listing will show a real photo, the price and availability. For now, tell us what you need and we’ll check our stock.</p><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> Check stock on WhatsApp</a></div><aside className="shelf-help"><h3>Looking for something specific?</h3><p>Send us a title, a child’s age or a photo of the item. We’ll check what we have and reply on WhatsApp.</p></aside></div></section>

    <section className="ghana-feature ghana-real shell" id="preloved" aria-labelledby="preloved-heading"><div className="ghana-copy"><p className="eyebrow">Preloved books</p><h2 id="preloved-heading">Good books deserve a second chapter.</h2><p>Our preloved books are checked page by page and graded Like new, Very good or Good, so you know exactly what you’re getting, for less.</p><Link className="button button-light" href="/shop?condition=preloved">Shop preloved <span aria-hidden="true">↗</span></Link></div><div className="ghana-detail"><span>Bookish Delight GH</span><strong>Like new · Very good · Good</strong><p>Every grade explained on the book page.</p></div></section>

    <section className="bottom-story shell section" id="about"><div><p className="eyebrow">About us</p><h2>Learning made delightful, from Kumasi.</h2></div><div className="bottom-story-copy"><p>We help parents, teachers and schools find brand new and preloved books children enjoy, from board books to teen novels, plus educational resources and Christian literature. Tell us a child’s age or what they’re learning and we’ll suggest what’s available.</p><Link className="text-link" href="/contact">Find us in Kumasi <span aria-hidden="true">↗</span></Link></div></section>

    <section className="ask-banner shell"><div><p className="eyebrow">Need something particular?</p><h2>We can check our shelves.</h2><p>Send a title, a child’s age or a photo to our WhatsApp number and we’ll let you know.</p></div><a className="button button-dark" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a></section>
  </main>;
}
