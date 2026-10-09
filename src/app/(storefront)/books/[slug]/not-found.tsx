import Link from "next/link";

export default function BookNotFound() {
  return <main className="interior-page shell empty-state"><h1>This item isn’t on the shelf.</h1><p>It may have sold out or been removed. Browse what’s in stock now.</p><Link className="button button-dark" href="/shop">Browse the shop ↗</Link></main>;
}
