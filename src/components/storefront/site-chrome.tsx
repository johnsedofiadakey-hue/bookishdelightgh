"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/storefront/brand-lockup";
import { BagIcon, SearchIcon, WhatsAppIcon } from "@/components/storefront/icons";
import { useCart } from "@/components/storefront/cart-context";
import { bookishBrand, bookishSocials, bookishWhatsAppUrl } from "@/lib/brand";

export function SiteHeader({ showBundles }: { showBundles: boolean }) {
  const { count } = useCart();

  return <>
    <div className="preview-ribbon">Store preview <span>·</span> We’re adding our products online <span>·</span> Online orders unavailable</div>
    <div className="announcement"><span>Brand new &amp; preloved children’s books.</span><span>Based in Kumasi · Nationwide delivery planned</span></div>
    <header className="site-header">
      <div className="header-inner shell">
        <Link className="brand" href="/" aria-label="Bookish Delight Ghana home"><BrandLockup/></Link>
        <nav className="desktop-nav" aria-label="Primary navigation"><Link href="/shop">Shop all</Link><Link href="/shop?condition=new">Brand new</Link><Link href="/shop?condition=preloved">Preloved</Link>{showBundles ? <Link href="/shop?category=bundles">Bundle deals</Link> : null}<Link href="/contact">Contact</Link></nav>
        <div className="header-actions">
          <form className="search-shortcut" action="/shop" role="search"><button className="search-submit" type="submit" aria-label="Search the shop"><SearchIcon/></button><input name="q" type="search" placeholder="Find a book..." aria-label="Search the shop" /></form>
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

export function SiteFooter({ showBundles }: { showBundles: boolean }) {
  return <footer className="footer"><div className="shell footer-inner">
    <div className="footer-identity"><Link className="brand footer-lockup" href="/" aria-label="Bookish Delight Ghana home"><BrandLockup footer/></Link><p>{bookishBrand.tagline}.</p><span className="footer-preview">Store preview · Online orders unavailable</span></div>
    <div className="footer-links"><h2>Explore</h2><Link href="/shop">Shop all</Link><Link href="/shop?condition=new">Brand new</Link><Link href="/shop?condition=preloved">Preloved</Link>{showBundles ? <Link href="/shop?category=bundles">Bundle deals</Link> : null}<Link href="/#categories">All shelves</Link><Link href="/contact">Contact us</Link></div>
    <div className="footer-links"><h2>Help</h2><Link href="/track">Track your order</Link><Link href="/delivery">Delivery</Link><Link href="/returns">Returns &amp; refunds</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/safety">Product safety</Link></div>
    <div className="footer-contact"><h2>Find us</h2><p>{bookishBrand.streetAddress}</p><p>GPS: {bookishBrand.gpsAddress}<br/>{bookishBrand.postalAddress}</p><a href={bookishWhatsAppUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/> WhatsApp {bookishBrand.whatsappDisplay}</a><div className="footer-socials">{bookishSocials.map((social) => <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer">{social.name} {social.handle}</a>)}</div></div>
  </div><div className="shell footer-bottom"><span>© {new Date().getFullYear()} Bookish Delight GH</span><div className="footer-bottom-actions"><Link href="/#top">Back to top ↑</Link><Link className="footer-admin-link" href="/admin/sign-in">Admin login</Link></div></div></footer>;
}
