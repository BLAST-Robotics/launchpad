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
import { timestamps, uuidPk } from "./columns";
import { memberStatusEnum, roleEnum } from "./enums";

/**
 * Better Auth's four required tables, with LaunchPad's extra user fields.
 *
 * Column names follow Better Auth's defaults exactly: the Drizzle adapter resolves
 * model → table → column by these names, and a rename here returns empty rows rather
 * than an error. IDs are UUIDs because `advanced.database.generateId` is set to
 * `crypto.randomUUID()` in apps/api/src/auth.ts.
 *
 * `user.roster_entry_id` is a cache of the claimed entry for fast session rendering.
 * The authoritative link and the uniqueness guarantee live on
 * `roster_entries.claimed_by_user_id`; there is deliberately no circular FK here.
 */
export const users = pgTable(
  "user",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    roles: roleEnum("roles").array().notNull().default(sql`ARRAY['pending']::"role"[]`),
    status: memberStatusEnum("status").notNull().default("active"),
    rosterEntryId: uuid("roster_entry_id"),
    googleSub: text("google_sub"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    graduationYear: integer("graduation_year"),
    /** What the person said they are; roles are only granted by a claim, never by this. */
    requestedRole: text("requested_role"),
    profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    check(
      "user_requested_role_check",
      sql`${table.requestedRole} is null or ${table.requestedRole} in ('student', 'parent', 'mentor')`,
    ),
    uniqueIndex("user_google_sub_unique").on(table.googleSub),
    index("user_roster_entry_idx").on(table.rosterEntryId),
    index("user_status_idx").on(table.status),
  ],
);

export const sessions = pgTable(
  "session",
  {
    id: uuidPk(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "account",
  {
    id: uuidPk(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId),
    index("account_user_id_idx").on(table.userId),
  ],
);

export const verifications = pgTable(
  "verification",
  {
    id: uuidPk(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
