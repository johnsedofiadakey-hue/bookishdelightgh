import Image from "next/image";
import type { PublicBook } from "@/lib/contracts/catalog";

export function BookCover({ book }: { book: PublicBook }) {
  return book.coverImageUrl
    ? <Image className="stock-book-cover" src={book.coverImageUrl} alt={`Cover of ${book.title} by ${book.author}`} fill sizes="(max-width: 600px) 45vw, 250px" unoptimized/>
    : <span className="stock-cover-pending">Cover photo pending</span>;
}
