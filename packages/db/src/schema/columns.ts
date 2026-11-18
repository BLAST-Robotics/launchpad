import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Every table carries created_at / updated_at. This is the only place that rule lives.
 * Append-only tables (`waiver_signatures`, `audit_log`) deliberately use createdAt only.
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** UUID primary key generated in Postgres. External IDs are never primary keys. */
export const uuidPk = () => uuid("id").primaryKey().defaultRandom();
