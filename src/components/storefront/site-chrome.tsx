"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/storefront/brand-lockup";
import { BagIcon, SearchIcon, WhatsAppIcon } from "@/components/storefront/icons";
import { useCart } from "@/components/storefront/cart-context";
import { bookishBrand, bookishWhatsAppUrl } from "@/lib/brand";

export function SiteHeader() {
  const { count } = useCart();

  return <>
    <div className="preview-ribbon">Store preview <span>·</span> We’re adding our books online <span>·</span> Online orders unavailable</div>
    <div className="announcement"><span>Books for readers of every age.</span><span>Based in Kumasi · Nationwide delivery planned</span></div>
    <header className="site-header">
      <div className="header-inner shell">
        <Link className="brand" href="/" aria-label="Bookish Delight Ghana home"><BrandLockup/></Link>
        <nav className="desktop-nav" aria-label="Primary navigation"><Link href="/shop">Shop all</Link><Link href="/#categories">Categories</Link><Link href="/shop?category=ghanaian">Ghanaian reads</Link><Link href="/contact">Contact</Link></nav>
        <div className="header-actions">
          <form className="search-shortcut" action="/shop" role="search"><button className="search-submit" type="submit" aria-label="Search books"><SearchIcon/></button><input name="q" type="search" placeholder="Find a book..." aria-label="Search books" /></form>
          <Link className="icon-button bag" href="/cart" aria-label={`Shopping bag with ${count} items`}><BagIcon/><span className="bag-count">{count}</span></Link>
          <a className="header-whatsapp" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/><span>Let’s chat</span></a>
        </div>
      </div>
    </header>
  </>;
}

export function MobileNav() {
  const { count } = useCart();
  return <nav className="mobile-bar" aria-label="Mobile navigation"><Link href="/"><span aria-hidden="true">⌂</span>Home</Link><Link href="/#categories"><span aria-hidden="true">▦</span>Categories</Link><Link href="/shop"><span aria-hidden="true">⌕</span>Search</Link><Link href="/cart"><span aria-hidden="true">♧</span>Bag{count > 0 ? ` (${count})` : ""}</Link></nav>;
}

export function FloatingWhatsApp() {
  const pathname = usePathname();
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const footer = document.querySelector(".storefront .footer");
    if (!footer || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), { rootMargin: "0px 0px 50px 0px" });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname === "/contact" || footerVisible) return null;
  return <a className="floating-whatsapp" href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ask Bookish Delight a question on WhatsApp at ${bookishBrand.whatsappDisplay}`}><WhatsAppIcon/><span>Ask us</span></a>;
}

export function SiteFooter() {
  return <footer className="footer"><div className="shell footer-inner">
    <div className="footer-identity"><Link className="brand footer-lockup" href="/" aria-label="Bookish Delight Ghana home"><BrandLockup footer/></Link><p>{bookishBrand.tagline}.</p><span className="footer-preview">Store preview · Online orders unavailable</span></div>
    <div className="footer-links"><h2>Explore</h2><Link href="/shop">Shop all books</Link><Link href="/shop?category=children">Children’s books</Link><Link href="/shop?category=ghanaian">Ghanaian reads</Link><Link href="/contact">Contact us</Link></div>
    <div className="footer-contact"><h2>Find us</h2><p>{bookishBrand.streetAddress}</p><p>GPS: {bookishBrand.gpsAddress}<br/>{bookishBrand.postalAddress}</p><a href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a></div>
  </div><div className="shell footer-bottom"><span>© {new Date().getFullYear()} Bookish Delight GH</span><div className="footer-bottom-actions"><Link href="/#top">Back to top ↑</Link><Link className="footer-admin-link" href="/admin/sign-in">Admin login</Link></div></div></footer>;
}
