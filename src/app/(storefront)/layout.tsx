import type { ReactNode } from "react";
import { CartProvider } from "@/components/storefront/cart-context";
import { MotionController } from "@/components/storefront/motion-controller";
import { FloatingWhatsApp, MobileNav, SiteFooter, SiteHeader } from "@/components/storefront/site-chrome";
import { getPublicCategories } from "@/lib/storefront/public-catalog";
import "../storefront.css";
import "../brand-refresh.css";
import "../realism.css";
import "../human-touch.css";
import "../home-vibrant.css";
import "../policies.css";
import "../commerce.css";
import "../home-motion.css";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const showBundles = (await getPublicCategories()).some((category) => category.slug === "bundles");
  return <div className="storefront"><CartProvider><MotionController/><SiteHeader showBundles={showBundles}/>{children}<SiteFooter showBundles={showBundles}/><FloatingWhatsApp/><MobileNav/></CartProvider></div>;
}
