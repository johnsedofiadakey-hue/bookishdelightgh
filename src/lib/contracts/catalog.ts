export type BookFormat =
  | "Paperback"
  | "Hardcover"
  | "Board book"
  | "Box set"
  | "Spiral bound"
  | "Activity book"
  | "Workbook"
  | "Flashcards"
  | "Puzzle"
  | "Game"
  | "Learning toy";

export type BookCategory =
  | "picture-books"
  | "storybooks"
  | "learning"
  | "puzzles"
  | "games"
  | "ghanaian";

export interface BookVariant {
  sku: string;
  format: BookFormat;
  pricePesewas: number;
  available: number;
  isbn?: string;
}

export interface PublicBook {
  id: string;
  slug: string;
  title: string;
  author: string;
  categories: BookCategory[];
  label: string;
  description: string;
  coverImageUrl?: string;
  variant: BookVariant;
}

export function formatGhs(pesewas: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(pesewas / 100);
}
