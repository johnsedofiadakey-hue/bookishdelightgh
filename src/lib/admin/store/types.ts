import type { AdminCollections, CollectionName } from "@/lib/admin/types";

/**
 * The persistence port the admin operations are written against.
 *
 * It deliberately mirrors the Firestore Admin SDK so the production adapter is
 * a thin mapping (see ADMIN_INTEGRATION_NOTES.md):
 * - `runTransaction` retries/serialises like `db.runTransaction`.
 * - Inside a transaction every read must happen before the first write.
 * - `create` fails the whole transaction if the document already exists. This
 *   is what makes movement IDs, idempotency keys and SMS event keys unique.
 */

export type WhereOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";

export type Where<T> = readonly [field: Extract<keyof T, string>, op: WhereOp, value: unknown];

export interface QueryOptions<T> {
  where?: Where<T>[];
  orderBy?: { field: Extract<keyof T, string>; direction?: "asc" | "desc" };
  limit?: number;
}

export type Doc<C extends CollectionName> = AdminCollections[C];

export interface AdminTransaction {
  get<C extends CollectionName>(collection: C, id: string): Promise<Doc<C> | null>;
  query<C extends CollectionName>(collection: C, options?: QueryOptions<Doc<C>>): Promise<Doc<C>[]>;
  create<C extends CollectionName>(collection: C, id: string, data: Doc<C>): void;
  set<C extends CollectionName>(collection: C, id: string, data: Doc<C>): void;
  update<C extends CollectionName>(collection: C, id: string, patch: Partial<Doc<C>>): void;
  delete<C extends CollectionName>(collection: C, id: string): void;
}

export interface AdminDataStore {
  readonly kind: "memory" | "firestore";
  /** True when the data is local development fixtures, never business data. */
  readonly isDevelopmentData: boolean;
  get<C extends CollectionName>(collection: C, id: string): Promise<Doc<C> | null>;
  query<C extends CollectionName>(collection: C, options?: QueryOptions<Doc<C>>): Promise<Doc<C>[]>;
  runTransaction<T>(work: (tx: AdminTransaction) => Promise<T>): Promise<T>;
}

/** Collections that ordinary operations may never delete from. */
export const APPEND_ONLY: ReadonlySet<CollectionName> = new Set<CollectionName>(["stockMovements", "auditEvents", "idempotencyKeys"]);
