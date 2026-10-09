import { configuredStoreKind, devStoreAllowed } from "@/lib/admin/env";
import { AdminError } from "@/lib/admin/errors";
import { newId } from "@/lib/admin/ids";
import type { ImageRef } from "@/lib/admin/types";
import { getStorage } from "firebase-admin/storage";
import { FirebaseMediaStorage, getAdapterApp } from "@/lib/firebase/admin-adapters";

/**
 * Image uploads for covers, gallery and homepage art.
 *
 * Policy:
 * - Accept JPEG, PNG or WebP only, verified by magic bytes, max 8 MB.
 * - Re-encode server-side to WebP (max 1600 px long edge, metadata stripped).
 *   Firestore stores only the resulting `ImageRef` (path + URL), never bytes.
 * - Orphans: a replaced image is deleted after the transaction that swaps it
 *   commits; a freshly uploaded image is deleted if that transaction fails.
 *   Images still referenced by the published homepage are kept.
 *
 * The production `MediaStorage` (Firebase Storage via the Admin SDK) is
 * supplied by shared Firebase (request R7).
 */

export interface MediaStorage {
  readonly kind: "firebase" | "development";
  put(path: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }>;
  delete(path: string): Promise<void>;
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;

type RegisteredMediaGlobal = typeof globalThis & { __bookishRegisteredMedia?: MediaStorage };

export function registerMediaStorage(storage: MediaStorage): void {
  (globalThis as RegisteredMediaGlobal).__bookishRegisteredMedia = storage;
}

type MediaGlobal = typeof globalThis & { __bookishDevMedia?: Map<string, { bytes: Uint8Array; contentType: string }> };

export function devMediaTable(): Map<string, { bytes: Uint8Array; contentType: string }> {
  const holder = globalThis as MediaGlobal;
  holder.__bookishDevMedia ??= new Map();
  return holder.__bookishDevMedia;
}

/** DEVELOPMENT-ONLY storage served from /admin/media/… by the admin route handler. */
const developmentStorage: MediaStorage = {
  kind: "development",
  async put(path, bytes, contentType) {
    devMediaTable().set(path, { bytes, contentType });
    return { url: `/admin/media/${path}` };
  },
  async delete(path) {
    devMediaTable().delete(path);
  },
};

export function getMediaStorage(): MediaStorage {
  if (configuredStoreKind() === "memory" && devStoreAllowed()) return developmentStorage;
  const holder = globalThis as RegisteredMediaGlobal;
  if (holder.__bookishRegisteredMedia) return holder.__bookishRegisteredMedia;
  holder.__bookishRegisteredMedia = new FirebaseMediaStorage(getStorage(getAdapterApp()));
  return holder.__bookishRegisteredMedia;
}

export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export type MediaFolder = "covers" | "gallery" | "homepage" | "categories";

/** Validate, compress and store an image. Returns the ImageRef to save. */
export async function processAndStoreImage(file: File, folder: MediaFolder, ownerId: string, alt: string): Promise<ImageRef> {
  if (file.size === 0) throw new AdminError("invalid", "Choose an image file.", { file: "Required" });
  if (file.size > MAX_UPLOAD_BYTES) throw new AdminError("invalid", "Images must be 8 MB or smaller.", { file: "Too large" });
  const trimmedAlt = alt.trim();
  if (!trimmedAlt || trimmedAlt.length > 250) throw new AdminError("invalid", "Describe the image in alt text (max 250 characters).", { alt: "Required" });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) throw new AdminError("invalid", "Invalid image owner.");
  const input = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(input);
  if (!sniffed) throw new AdminError("invalid", "Upload a JPEG, PNG or WebP image.", { file: "Unsupported type" });

  let sharp: typeof import("sharp").default;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new AdminError("unavailable", "Image processing is unavailable on this server (sharp not installed; shared request R7).");
  }
  let output: { data: Buffer; info: { width: number; height: number; size: number } };
  try {
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AdminError("invalid", "This image could not be read. Try exporting it again as JPEG or PNG.", { file: "Unreadable" });
  }
  const path = `${folder}/${ownerId}/${newId("img")}.webp`;
  const { url } = await getMediaStorage().put(path, new Uint8Array(output.data), "image/webp");
  return { path, url, alt: trimmedAlt, width: output.info.width, height: output.info.height, bytes: output.info.size, contentType: "image/webp" };
}

/** Best-effort orphan cleanup; failures are logged, never surfaced to staff. */
export async function deleteImageQuietly(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await getMediaStorage().delete(path);
  } catch (error) {
    console.warn(`[admin/media] could not delete orphan ${path}`, error);
  }
}
