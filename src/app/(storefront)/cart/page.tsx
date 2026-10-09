import type { Metadata } from "next";
import { getPublicCatalog } from "@/lib/storefront/public-catalog";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your bag | Bookish Delight GH", robots: { index: false } };

export default async function CartPage() {
  return <CartView catalog={await getPublicCatalog()}/>;
}
