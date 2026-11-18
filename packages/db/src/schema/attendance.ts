import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { timestamps, uuidPk } from "./columns";
import { attendanceDirectionEnum, attendanceSourceEnum } from "./enums";
import { rosterEntries } from "./roster";

/**
 * Attendance enters LaunchPad; it is never mastered here (D-006). Manual entries carry
 * `recorded_by`; imported rows are replaced wholesale per reconcile and keep the raw
 * payload so a bad import can be audited.
 */
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuidPk(),
    rosterEntryId: uuid("roster_entry_id")
      .notNull()
      .references(() => rosterEntries.id, { onDelete: "cascade" }),
    source: attendanceSourceEnum("source").notNull(),
    direction: attendanceDirectionEnum("direction").notNull(),
    happenedAt: timestamp("happened_at", { withTimezone: true }).notNull(),
    sessionRef: text("session_ref"),
    minutes: integer("minutes"),
    raw: jsonb("raw").$type<unknown>(),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("attendance_records_entry_happened_idx").on(table.rosterEntryId, table.happenedAt),
    index("attendance_records_source_idx").on(table.source),
  ],
);
