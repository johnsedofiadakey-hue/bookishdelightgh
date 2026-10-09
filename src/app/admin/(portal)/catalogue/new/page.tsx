import { randomUUID } from "node:crypto";
import { BookForm } from "@/components/admin/book-form";
import { Card, PageHeader, PermissionDenied } from "@/components/admin/ui";
import { pageAccess } from "@/lib/admin/auth/guard";
import { listCategories } from "@/lib/admin/ops/catalogue";
import { getAdminStore } from "@/lib/admin/store";
import { saveBookAction } from "../actions";

export const metadata = { title: "Add a book" };

export default async function NewBookPage() {
  const access = await pageAccess("catalogue.edit");
  if (!access.ok) return <PermissionDenied permission={access.permission} />;
  const store = getAdminStore();
  const [categories, books] = await Promise.all([listCategories(store), store.query("books")]);

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin/catalogue", label: "Catalogue" }]} eyebrow="New book" title="Add a book" lede="First choose a book type, such as Early Readers. Next choose whether this stock is Brand New, Preloved or a Bundle Deal, then add its price, stock and real cover photo." />
      <ol className="adm-steps" aria-label="Publishing steps">
        <li data-state="current">1 · Details</li>
        <li>2 · Shop section, SKU &amp; price</li>
        <li>3 · Opening stock</li>
        <li>4 · Cover</li>
        <li>5 · Preview &amp; publish</li>
      </ol>
      <Card>
        <BookForm action={saveBookAction} idempotencyKey={randomUUID()} categories={categories} otherBooks={books.filter((book) => book.status !== "archived").map((book) => ({ id: book.id, title: book.title, status: book.status }))} />
      </Card>
    </>
  );
}
