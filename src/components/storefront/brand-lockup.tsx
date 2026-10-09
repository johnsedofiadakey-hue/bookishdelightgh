import Image from "next/image";
import { bookishBrand } from "@/lib/brand";

export function BrandLockup({ footer = false }: { footer?: boolean }) {
  return <>
    <span className={`brand-symbol${footer ? " brand-symbol-footer" : ""}`} aria-hidden="true">
      <Image src={bookishBrand.logoPath} alt="" width={1024} height={1024} priority={!footer}/>
    </span>
    <span className="brand-lockup-type"><strong>Bookish <span>Delight</span> <b>GH</b></strong><small>Nurturing young minds</small></span>
  </>;
}
