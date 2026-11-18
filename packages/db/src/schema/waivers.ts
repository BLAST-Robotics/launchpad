import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { timestamps, uuidPk } from "./columns";
import { roleEnum } from "./enums";
import { seasons } from "./roster";

/**
 * Waiver *definitions*. Changing what a waiver says creates a new row (new version);
 * old rows and their signatures stay immutable.
 *
 * `internal_waiver` / `is_cleared` are never columns on the user. Status is derived:
 * active required documents ∩ effective roles ∩ signature rows (ARCHITECTURE §5).
 */
export const waiverDocuments = pgTable(
  "waiver_documents",
  {
    id: uuidPk(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    version: integer("version").notNull().default(1),
    audienceRoles: roleEnum("audience_roles").array().notNull().default(sql`ARRAY[]::"role"[]`),
    pdfDriveId: text("pdf_drive_id"),
    keysignDocumentId: text("keysign_document_id"),
    isRequired: boolean("is_required").notNull().default(true),
    activeFrom: timestamp("active_from", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("waiver_documents_season_title_version_unique").on(
      table.seasonId,
      table.title,
      table.version,
    ),
    index("waiver_documents_active_idx").on(table.seasonId, table.isRequired),
  ],
);

/**
 * Append-only evidence. No `updated_at`: a row is written once by the KeySign webhook.
 * The unique (document, user, source) triple makes a duplicate webhook delivery a no-op, and
 * lets a later KeySign confirmation sit beside an earlier self-report instead of being dropped.
 */
export const waiverSignatures = pgTable(
  "waiver_signatures",
  {
    id: uuidPk(),
    waiverDocumentId: uuid("waiver_document_id")
      .notNull()
      .references(() => waiverDocuments.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    keysignSignatureId: text("keysign_signature_id"),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
    pdfDriveId: text("pdf_drive_id"),
    signerRole: text("signer_role"),
    /** keysign = confirmed by the KeySign webhook; self_reported = the person said they signed. */
    source: text("source").notNull().default("keysign"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("waiver_signatures_source_check", sql`${table.source} in ('keysign','self_reported')`),
    uniqueIndex("waiver_signatures_document_user_source_unique").on(
      table.waiverDocumentId,
      table.userId,
      table.source,
    ),
    index("waiver_signatures_user_idx").on(table.userId),
  ],
);
