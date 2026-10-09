import { AdminError } from "@/lib/admin/errors";
import type { CollectionName } from "@/lib/admin/types";
import { APPEND_ONLY, type AdminDataStore, type AdminTransaction, type Doc, type QueryOptions, type Where } from "@/lib/admin/store/types";

/**
 * DEVELOPMENT-ONLY in-memory store.
 *
 * Implements the same transactional contract the Firestore adapter must honour
 * (serialised transactions, reads-before-writes, `create` conflicts), so the
 * admin operations and their tests exercise real concurrency rules. Data is
 * lost on restart and is never business data.
 */

type Table = Map<string, unknown>;

type PendingWrite =
  | { kind: "create"; collection: CollectionName; id: string; data: unknown }
  | { kind: "set"; collection: CollectionName; id: string; data: unknown }
  | { kind: "update"; collection: CollectionName; id: string; patch: Record<string, unknown> }
  | { kind: "delete"; collection: CollectionName; id: string };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function matches<T>(doc: T, clause: Where<T>): boolean {
  const [field, op, value] = clause;
  const actual = (doc as Record<string, unknown>)[field];
  switch (op) {
    case "==":
      return actual === value;
    case "!=":
      return actual !== value;
    case "<":
      return compare(actual, value) < 0;
    case "<=":
      return compare(actual, value) <= 0;
    case ">":
      return compare(actual, value) > 0;
    case ">=":
      return compare(actual, value) >= 0;
    case "in":
      return Array.isArray(value) && value.includes(actual);
    case "array-contains":
      return Array.isArray(actual) && actual.includes(value);
  }
}

function runQuery<T>(table: Table, options: QueryOptions<T> = {}): T[] {
  let rows = [...table.values()] as T[];
  for (const clause of options.where ?? []) rows = rows.filter((row) => matches(row, clause));
  if (options.orderBy) {
    const { field, direction = "asc" } = options.orderBy;
    rows.sort((left, right) => {
      const order = compare((left as Record<string, unknown>)[field], (right as Record<string, unknown>)[field]);
      return direction === "asc" ? order : -order;
    });
  }
  if (options.limit !== undefined) rows = rows.slice(0, options.limit);
  return rows.map(clone);
}

export class MemoryAdminStore implements AdminDataStore {
  readonly kind = "memory" as const;
  readonly isDevelopmentData = true;
  private readonly tables = new Map<CollectionName, Table>();
  private queue: Promise<unknown> = Promise.resolve();

  private table(collection: CollectionName): Table {
    let table = this.tables.get(collection);
    if (!table) {
      table = new Map();
      this.tables.set(collection, table);
    }
    return table;
  }

  async get<C extends CollectionName>(collection: C, id: string): Promise<Doc<C> | null> {
    const value = this.table(collection).get(id);
    return value === undefined ? null : (clone(value) as Doc<C>);
  }

  async query<C extends CollectionName>(collection: C, options?: QueryOptions<Doc<C>>): Promise<Doc<C>[]> {
    return runQuery(this.table(collection), options) as Doc<C>[];
  }

  /** Seed helper for fixtures and tests. Bypasses transactions on purpose. */
  seed<C extends CollectionName>(collection: C, id: string, data: Doc<C>): void {
    this.table(collection).set(id, clone(data));
  }

  runTransaction<T>(work: (tx: AdminTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const writes: PendingWrite[] = [];
      let wrote = false;
      const guardRead = () => {
        if (wrote) throw new Error("Transaction reads must happen before writes (Firestore rule).");
      };
      const tx: AdminTransaction = {
        get: async (collection, id) => {
          guardRead();
          return this.get(collection, id);
        },
        query: async (collection, options) => {
          guardRead();
          return this.query(collection, options);
        },
        create: (collection, id, data) => {
          wrote = true;
          writes.push({ kind: "create", collection, id, data: clone(data) });
        },
        set: (collection, id, data) => {
          wrote = true;
          writes.push({ kind: "set", collection, id, data: clone(data) });
        },
        update: (collection, id, patch) => {
          wrote = true;
          writes.push({ kind: "update", collection, id, patch: clone(patch) as Record<string, unknown> });
        },
        delete: (collection, id) => {
          wrote = true;
          if (APPEND_ONLY.has(collection)) throw new AdminError("forbidden", `${collection} is append-only.`);
          writes.push({ kind: "delete", collection, id });
        },
      };

      const result = await work(tx);

      // Validate the whole batch before applying any of it (atomic commit).
      const staged = new Map<string, unknown>();
      const key = (collection: CollectionName, id: string) => `${collection}/${id}`;
      const current = (collection: CollectionName, id: string) => {
        const k = key(collection, id);
        return staged.has(k) ? staged.get(k) : this.table(collection).get(id);
      };
      for (const write of writes) {
        const existing = current(write.collection, write.id);
        if (write.kind === "create") {
          if (existing !== undefined) throw new AdminError("conflict", `Document ${write.collection}/${write.id} already exists.`);
          staged.set(key(write.collection, write.id), write.data);
        } else if (write.kind === "set") {
          if (APPEND_ONLY.has(write.collection) && existing !== undefined) throw new AdminError("forbidden", `${write.collection} is append-only.`);
          staged.set(key(write.collection, write.id), write.data);
        } else if (write.kind === "update") {
          if (existing === undefined) throw new AdminError("not_found", `Document ${write.collection}/${write.id} does not exist.`);
          if (APPEND_ONLY.has(write.collection)) throw new AdminError("forbidden", `${write.collection} is append-only.`);
          staged.set(key(write.collection, write.id), { ...(existing as Record<string, unknown>), ...write.patch });
        } else {
          staged.set(key(write.collection, write.id), undefined);
        }
      }
      for (const [k, value] of staged) {
        const [collection, ...rest] = k.split("/");
        const id = rest.join("/");
        if (value === undefined) this.table(collection as CollectionName).delete(id);
        else this.table(collection as CollectionName).set(id, value);
      }
      return result;
    };

    // Serialise transactions: equivalent to Firestore's optimistic retry for
    // correctness purposes, and deterministic for tests.
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
