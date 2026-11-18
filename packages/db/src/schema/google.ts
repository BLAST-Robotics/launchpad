import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { timestamps, uuidPk } from "./columns";
import { googleObjectKindEnum } from "./enums";

/**
 * The only place external Google identifiers exist (D-019). No group email, folder ID,
 * calendar ID or Slack channel ID is hardcoded in source; callers resolve a logical
 * key through this table.
 */
export const googleObjects = pgTable(
  "google_objects",
  {
    id: uuidPk(),
    kind: googleObjectKindEnum("kind").notNull(),
    /** Logical key, e.g. `students`, `parents`, `subteam:programming`, `drives.team`. */
    key: text("key").notNull(),
    externalId: text("external_id").notNull(),
    email: text("email"),
    label: text("label"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("google_objects_kind_key_unique").on(table.kind, table.key)],
);

/** The diff between what was computed and what Google actually has. */
export const provisioningState = pgTable(
  "provisioning_state",
  {
    id: uuidPk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    desired: jsonb("desired").$type<unknown>(),
    applied: jsonb("applied").$type<unknown>(),
    lastError: text("last_error"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("provisioning_state_user_unique").on(table.userId)],
);

/**
 * Append-only. One row per admin action. `updated_at` is intentionally absent.
 * `before` / `after` are JSON snapshots with no tokens or PII beyond what the row is.
 */
export const auditLog = pgTable("audit_log", {
  id: uuidPk(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before").$type<unknown>(),
  after: jsonb("after").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
