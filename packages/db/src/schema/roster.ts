import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { timestamps, uuidPk } from "./columns";
import { rosterStatusEnum } from "./enums";

/**
 * Seasons replace tenants (DECISIONS D-017). A roster entry belongs to exactly one
 * season; people and their history survive rollover.
 */
export const seasons = pgTable(
  "seasons",
  {
    id: uuidPk(),
    name: text("name").notNull().unique(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("seasons_current_idx").on(table.isCurrent)],
);

export const rosterEntries = pgTable(
  "roster_entries",
  {
    id: uuidPk(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    grade: text("grade"),
    emailHint: text("email_hint"),
    /** UNIQUE: one student per entry, enforced by the database (D-005). */
    claimedByUserId: uuid("claimed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: rosterStatusEnum("status").notNull().default("unclaimed"),
    /** Imported from the team coordination sheet: paid | unpaid | unknown. */
    duesStatus: text("dues_status").notNull().default("unknown"),
    ...timestamps,
  },
  (table) => [
    check(
      "roster_entries_dues_status_check",
      sql`${table.duesStatus} in ('paid','unpaid','unknown')`,
    ),
    uniqueIndex("roster_entries_claimed_unique").on(table.claimedByUserId),
    uniqueIndex("roster_entries_season_email_unique").on(table.seasonId, table.emailHint),
    index("roster_entries_season_last_name_idx").on(table.seasonId, table.lastName),
  ],
);

/**
 * A guardian link is valid whether or not the student has claimed. A student may have
 * several guardians; a guardian may link to several students.
 */
export const guardianLinks = pgTable(
  "guardian_links",
  {
    id: uuidPk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rosterEntryId: uuid("roster_entry_id")
      .notNull()
      .references(() => rosterEntries.id, { onDelete: "cascade" }),
    relationship: text("relationship"),
    phone: text("phone"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("guardian_links_user_entry_unique").on(table.userId, table.rosterEntryId),
    index("guardian_links_entry_idx").on(table.rosterEntryId),
  ],
);

export const subteams = pgTable(
  "subteams",
  {
    id: uuidPk(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    mentorId: uuid("mentor_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [uniqueIndex("subteams_season_slug_unique").on(table.seasonId, table.slug)],
);

export const subteamMembers = pgTable(
  "subteam_members",
  {
    id: uuidPk(),
    subteamId: uuid("subteam_id")
      .notNull()
      .references(() => subteams.id, { onDelete: "cascade" }),
    rosterEntryId: uuid("roster_entry_id")
      .notNull()
      .references(() => rosterEntries.id, { onDelete: "cascade" }),
    isLead: boolean("is_lead").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subteam_members_unique").on(table.subteamId, table.rosterEntryId),
    index("subteam_members_entry_idx").on(table.rosterEntryId),
  ],
);
