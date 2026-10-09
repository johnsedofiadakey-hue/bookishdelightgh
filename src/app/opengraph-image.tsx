import { renderBrandShareCard } from "@/lib/brand-image";

export const alt = "Bookish Delight GH: children’s books for growing minds, from first stories to teen reads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderBrandShareCard();
}
