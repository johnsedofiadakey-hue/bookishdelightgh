import { renderBrandShareCard } from "@/lib/brand-image";

export const alt = "Bookish Delight GH: a Kumasi bookshop for children and adults";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderBrandShareCard();
}
