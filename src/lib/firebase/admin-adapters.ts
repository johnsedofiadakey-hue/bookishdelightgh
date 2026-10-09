import { randomUUID } from "node:crypto";
import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { Timestamp, type DocumentData, type Firestore, type Query, type Transaction } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { Storage } from "firebase-admin/storage";
import { AdminError } from "@/lib/admin/errors";
import { STAFF_CLAIM, type IdentityAdmin } from "@/lib/admin/auth/identity";
import { APPEND_ONLY, type AdminDataStore, type AdminTransaction, type Doc, type QueryOptions } from "@/lib/admin/store/types";
import type { CollectionName } from "@/lib/admin/types";
import type { MediaStorage } from "@/lib/admin/media";

/** The adapters are loaded only by server-side admin registries. */
export function getAdapterApp() {
  return getApps().length ? getApp() : initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function toFirestore(value: unknown): unknown {
  if (typeof value === "string" && ISO_INSTANT.test(value) && !Number.isNaN(Date.parse(value))) {
    return Timestamp.fromDate(new Date(value));
  }
  if (Array.isArray(value)) return value.map(toFirestore);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, toFirestore(item)]),
    );
  }
  return value;
}

function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fromFirestore(item)]));
  }
  return value;
}

function buildQuery<C extends CollectionName>(db: Firestore, collection: C, options?: QueryOptions<Doc<C>>): Query<DocumentData> {
  let query: Query<DocumentData> = db.collection(collection);
  for (const [field, op, value] of options?.where ?? []) query = query.where(field, op, toFirestore(value));
  if (options?.orderBy) query = query.orderBy(options.orderBy.field, options.orderBy.direction ?? "asc");
  if (options?.limit !== undefined) query = query.limit(options.limit);
  return query;
}

export class FirestoreAdminStore implements AdminDataStore {
  readonly kind = "firestore" as const;
  readonly isDevelopmentData = false;
  private readonly db: Firestore;

  constructor(db: Firestore) { this.db = db; }

  async get<C extends CollectionName>(collection: C, id: string): Promise<Doc<C> | null> {
    const snapshot = await this.db.collection(collection).doc(id).get();
    return snapshot.exists ? (fromFirestore(snapshot.data()) as Doc<C>) : null;
  }

  async query<C extends CollectionName>(collection: C, options?: QueryOptions<Doc<C>>): Promise<Doc<C>[]> {
    const snapshot = await buildQuery(this.db, collection, options).get();
    return snapshot.docs.map((doc) => fromFirestore(doc.data()) as Doc<C>);
  }

  runTransaction<T>(work: (tx: AdminTransaction) => Promise<T>): Promise<T> {
    return this.db.runTransaction(async (transaction: Transaction) => {
      let wrote = false;
      const guardRead = () => {
        if (wrote) throw new Error("Transaction reads must happen before writes (Firestore rule).");
      };
      const adapter: AdminTransaction = {
        get: async (collection, id) => {
          guardRead();
          const snapshot = await transaction.get(this.db.collection(collection).doc(id));
          return snapshot.exists ? (fromFirestore(snapshot.data()) as Doc<typeof collection>) : null;
        },
        query: async (collection, options) => {
          guardRead();
          const snapshot = await transaction.get(buildQuery(this.db, collection, options));
          return snapshot.docs.map((doc) => fromFirestore(doc.data()) as Doc<typeof collection>);
        },
        create: (collection, id, data) => {
          wrote = true;
          transaction.create(this.db.collection(collection).doc(id), toFirestore(data) as DocumentData);
        },
        set: (collection, id, data) => {
          if (APPEND_ONLY.has(collection)) throw new AdminError("forbidden", `${collection} is append-only; use create.`);
          wrote = true;
          transaction.set(this.db.collection(collection).doc(id), toFirestore(data) as DocumentData);
        },
        update: (collection, id, patch) => {
          if (APPEND_ONLY.has(collection)) throw new AdminError("forbidden", `${collection} is append-only.`);
          wrote = true;
          transaction.update(this.db.collection(collection).doc(id), toFirestore(patch) as DocumentData);
        },
        delete: (collection, id) => {
          if (APPEND_ONLY.has(collection)) throw new AdminError("forbidden", `${collection} is append-only.`);
          wrote = true;
          transaction.delete(this.db.collection(collection).doc(id));
        },
      };
      return work(adapter);
    });
  }
}

export class FirebaseIdentityAdmin implements IdentityAdmin {
  readonly kind = "firebase" as const;
  private readonly auth: Auth;

  constructor(auth: Auth) { this.auth = auth; }

  async isRevokedOrDisabled(uid: string, authTimeSeconds: number): Promise<boolean> {
    try {
      const user = await this.auth.getUser(uid);
      const revokedAfter = user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) / 1000 : 0;
      return user.disabled || revokedAfter > authTimeSeconds;
    } catch (error) {
      if ((error as { code?: string }).code === "auth/user-not-found") return true;
      throw error;
    }
  }

  async setStaffClaim(uid: string, staff: boolean): Promise<void> {
    const user = await this.auth.getUser(uid);
    const claims = { ...user.customClaims, [STAFF_CLAIM]: staff };
    await this.auth.setCustomUserClaims(uid, claims);
    if (!staff) await this.auth.revokeRefreshTokens(uid);
  }

  async findUserByEmail(email: string): Promise<{ uid: string; email: string; displayName?: string } | null> {
    try {
      const user = await this.auth.getUserByEmail(email.trim().toLowerCase());
      if (!user.email) return null;
      return { uid: user.uid, email: user.email, displayName: user.displayName };
    } catch (error) {
      if ((error as { code?: string }).code === "auth/user-not-found") return null;
      throw error;
    }
  }
}

export class FirebaseMediaStorage implements MediaStorage {
  readonly kind = "firebase" as const;
  private readonly storage: Storage;

  constructor(storage: Storage) { this.storage = storage; }

  async put(path: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }> {
    if (!/^(covers|gallery|homepage|categories)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.webp$/.test(path)) {
      throw new AdminError("invalid", "Invalid image path.");
    }
    if (contentType !== "image/webp") throw new AdminError("invalid", "Images must be WebP.");
    const bucket = this.storage.bucket();
    const token = randomUUID();
    await bucket.file(path).save(Buffer.from(bytes), {
      resumable: false,
      validation: "crc32c",
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    return { url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?alt=media&token=${token}` };
  }

  async delete(path: string): Promise<void> {
    if (!/^(covers|gallery|homepage|categories)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.webp$/.test(path)) {
      throw new AdminError("invalid", "Invalid image path.");
    }
    await this.storage.bucket().file(path).delete({ ignoreNotFound: true });
  }
}
