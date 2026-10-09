import { renderBrandIcon } from "@/lib/brand-image";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return renderBrandIcon(size.width);
}
