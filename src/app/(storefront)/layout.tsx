import type { ReactNode } from "react";
import { CartProvider } from "@/components/storefront/cart-context";
import { MotionController } from "@/components/storefront/motion-controller";
import { FloatingWhatsApp, MobileNav, SiteFooter, SiteHeader } from "@/components/storefront/site-chrome";
import "../storefront.css";
import "../brand-refresh.css";
import "../realism.css";
import "../human-touch.css";
import "../home-vibrant.css";
import "../policies.css";
import "../commerce.css";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <div className="storefront"><CartProvider><MotionController/><SiteHeader/>{children}<SiteFooter/><FloatingWhatsApp/><MobileNav/></CartProvider></div>;
}
