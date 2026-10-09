import type { StaffContext } from "@/lib/admin/context";
import { newId, nowIso } from "@/lib/admin/ids";
import type { AdminTransaction } from "@/lib/admin/store/types";
import type { AuditEvent } from "@/lib/admin/types";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Append an audit event inside the same transaction as the change it records. */
export function recordAudit(tx: AdminTransaction, ctx: StaffContext, entry: AuditEntry): AuditEvent {
  const event: AuditEvent = {
    id: newId("aud"),
    actorUid: ctx.uid,
    actorName: ctx.name,
    actorRole: ctx.role,
    requestId: ctx.requestId,
    at: nowIso(),
    ...entry,
  };
  tx.create("auditEvents", event.id, stripUndefined(event));
  return event;
}

/** Small before/after summaries; never whole documents with personal data. */
export function pick<T extends object, K extends keyof T>(source: T | null | undefined, keys: K[]): Record<string, unknown> | undefined {
  if (!source) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of keys) if (source[key] !== undefined) out[String(key)] = source[key];
  return out;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) if (inner !== undefined) out[key] = stripUndefined(inner);
    return out as T;
  }
  return value;
}
