import { renderBrandShareCard } from "@/lib/brand-image";

export const alt = "Bookish Delight GH: children’s books and educational resources in Kumasi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderBrandShareCard();
}
