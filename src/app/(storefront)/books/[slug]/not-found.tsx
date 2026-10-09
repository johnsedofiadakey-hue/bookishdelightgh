import Link from "next/link";

export default function BookNotFound() {
  return <main className="interior-page shell empty-state"><h1>This book isn’t on the shelf.</h1><p>Browse the current collection to find another read.</p><Link className="button button-dark" href="/shop">Browse books ↗</Link></main>;
}
