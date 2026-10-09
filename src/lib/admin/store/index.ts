import { configuredStoreKind, devStoreAllowed } from "@/lib/admin/env";
import { AdminError } from "@/lib/admin/errors";
import { MemoryAdminStore } from "@/lib/admin/store/memory";
import { seedDevelopmentStore } from "@/lib/admin/store/dev-seed";
import type { AdminDataStore } from "@/lib/admin/store/types";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreAdminStore, getAdapterApp } from "@/lib/firebase/admin-adapters";

type StoreGlobal = typeof globalThis & { __bookishAdminStore?: AdminDataStore; __bookishRegisteredAdminStore?: AdminDataStore };

/**
 * Lets the shared Firebase layer plug in the production adapter without the
 * admin importing a module that does not exist yet. Codex's
 * `src/lib/firebase` (or an instrumentation hook) calls this once at startup.
 */
export function registerAdminStore(store: AdminDataStore): void {
  (globalThis as StoreGlobal).__bookishRegisteredAdminStore = store;
}

export function getAdminStore(): AdminDataStore {
  const kind = configuredStoreKind();
  if (kind === "firestore") {
    const holder = globalThis as StoreGlobal;
    if (holder.__bookishRegisteredAdminStore?.kind !== "firestore") {
      holder.__bookishRegisteredAdminStore = new FirestoreAdminStore(getFirestore(getAdapterApp()));
    }
    return holder.__bookishRegisteredAdminStore;
  }
  if (!devStoreAllowed()) {
    throw new AdminError("unavailable", "The development store is disabled in production.");
  }
  const holder = globalThis as StoreGlobal;
  if (!holder.__bookishAdminStore) {
    const store = new MemoryAdminStore();
    if (process.env.BOOKISH_ADMIN_DEV_SEED !== "0") seedDevelopmentStore(store);
    holder.__bookishAdminStore = store;
  }
  return holder.__bookishAdminStore;
}

/** Test hook: replace the process-wide store. */
export function setAdminStoreForTests(store: AdminDataStore | undefined): void {
  (globalThis as StoreGlobal).__bookishAdminStore = store;
}
