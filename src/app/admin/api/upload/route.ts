import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/admin/auth/guard";
import { AdminError, httpStatusFor, isAdminError } from "@/lib/admin/errors";
import { deleteImageQuietly, processAndStoreImage } from "@/lib/admin/media";
import { addGalleryImage, setBookCover } from "@/lib/admin/ops/catalogue";
import { setHeroImage } from "@/lib/admin/ops/content";
import { getAdminStore } from "@/lib/admin/store";

/**
 * Multipart image upload. A valid staff session is checked before the body is read;
 * target-specific permission is checked before the image is processed or stored.
 * The image is then linked in an audited transaction.
 * If linking fails the new file is deleted; if it replaced an older file,
 * the older file is deleted after the commit (orphan cleanup).
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });

  if (Number(request.headers.get("content-length") ?? 0) > 9 * 1024 * 1024) return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });

  let storedPath: string | null = null;
  try {
    await requireStaff();
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
      throw new AdminError("invalid", "Upload must use multipart form data.");
    }
    const form = await request.formData();
    const target = form.get("target");
    // Authorise the requested target before processing the uploaded file.
    if (target === "cover" || target === "gallery") await requireStaff("catalogue.edit");
    else if (target === "hero") await requireStaff("content.edit");
    else throw new AdminError("invalid", "Unknown upload target.");
    const ownerId = String(form.get("ownerId") ?? "");
    const alt = String(form.get("alt") ?? "");
    const idempotencyKey = String(form.get("idempotencyKey") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) throw new AdminError("invalid", "Choose an image file.");
    const store = getAdminStore();

    if (target === "cover" || target === "gallery") {
      const ctx = await requireStaff("catalogue.edit");
      const book = await store.get("books", ownerId);
      if (!book) throw new AdminError("not_found", "Book not found.");
      const image = await processAndStoreImage(file, target === "cover" ? "covers" : "gallery", ownerId, alt);
      storedPath = image.path;
      if (target === "cover") {
        const { result, replayed } = await setBookCover(store, ctx, ownerId, image, idempotencyKey);
        if (replayed) await deleteImageQuietly(storedPath);
        else if (result.previousPath) await deleteImageQuietly(result.previousPath);
        storedPath = null;
        return NextResponse.json({ ok: true, message: replayed ? "This upload was already saved." : book.cover ? "Cover replaced." : "Cover added." });
      }
      const { replayed } = await addGalleryImage(store, ctx, ownerId, image, idempotencyKey);
      if (replayed) await deleteImageQuietly(storedPath);
      storedPath = null;
      return NextResponse.json({ ok: true, message: "Gallery image added." });
    }

    if (target === "hero") {
      const ctx = await requireStaff("content.edit");
      const image = await processAndStoreImage(file, "homepage", "hero", alt);
      storedPath = image.path;
      const { result, replayed } = await setHeroImage(store, ctx, image, idempotencyKey);
      if (replayed) await deleteImageQuietly(storedPath);
      else await deleteImageQuietly(result.previousPath);
      storedPath = null;
      return NextResponse.json({ ok: true, message: "Hero image saved to the draft." });
    }

    throw new AdminError("invalid", "Unknown upload target.");
  } catch (error) {
    if (storedPath) await deleteImageQuietly(storedPath);
    if (isAdminError(error)) return NextResponse.json({ error: error.message }, { status: httpStatusFor[error.code] });
    console.error("[admin upload]", error);
    return NextResponse.json({ error: "Upload failed on the server." }, { status: 500 });
  }
}
