import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/storefront/icons";

export default function BookNotFound() {
  return <main className="interior-page shell empty-state"><h1>We can’t find this item.</h1><p>It may have sold out or been taken down. See what we have now.</p><Link className="button button-dark" href="/shop">Browse the shop <ArrowUpRightIcon/></Link></main>;
}
