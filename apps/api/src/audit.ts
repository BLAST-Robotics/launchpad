import { type db, schema } from "@launchpad/db";

/** Either the shared client or an open transaction: audit rows are written alongside the change. */
export type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AuditEntry {
  /** null = the system (CLI bootstrap, background work). */
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  /** Small snapshots of the changed fields only. No tokens, no emails. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Append one `audit_log` row. Call it inside the same transaction as the change it records,
 * so the log can never say something happened that was rolled back, or miss something that
 * was committed.
 */
export async function writeAudit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(schema.auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
