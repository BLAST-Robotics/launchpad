import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { timestamps } from "./columns";
import { rosterEntries } from "./roster";

/**
 * One row per uploaded core-values video. The video itself lives in the Team Shared Drive and
 * is referenced only by `drive_file_id`; nothing is stored in the app. Submissions are
 * append-only in spirit: a resubmission is a new row and the latest wins. Only `status`
 * changes afterwards (an admin approving it or asking for a redo).
 *
 * `id` is issued by the server when the upload session is created and is embedded in the Drive
 * file name, which is how a file is tied to the submission it was issued for.
 */
export const coreValueSubmissions = pgTable(
  "core_value_submissions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rosterEntryId: uuid("roster_entry_id").references(() => rosterEntries.id, {
      onDelete: "set null",
    }),
    coreValue: text("core_value").notNull(),
    driveFileId: text("drive_file_id").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    /** Null until Drive has processed the video; filled when known. */
    durationMs: integer("duration_ms"),
    status: text("status").notNull().default("uploaded"),
    ...timestamps,
  },
  (table) => [
    check(
      "core_value_submissions_value_check",
      sql`${table.coreValue} in ('discovery','innovation','impact','inclusion','teamwork','fun')`,
    ),
    check(
      "core_value_submissions_status_check",
      sql`${table.status} in ('uploaded','approved','needs_redo')`,
    ),
    index("core_value_submissions_user_idx").on(table.userId, table.createdAt),
    index("core_value_submissions_status_idx").on(table.status, table.createdAt),
  ],
);
