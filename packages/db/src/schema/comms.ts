import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { timestamps, uuidPk } from "./columns";
import { deliveryChannelEnum, deliveryStatusEnum, roleEnum } from "./enums";

export const events = pgTable(
  "events",
  {
    id: uuidPk(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text("location"),
    audienceRoles: roleEnum("audience_roles").array().notNull().default(sql`ARRAY[]::"role"[]`),
    googleCalendarEventId: text("google_calendar_event_id"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("events_starts_at_idx").on(table.startsAt)],
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuidPk(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audienceRoles: roleEnum("audience_roles").array().notNull().default(sql`ARRAY[]::"role"[]`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("announcements_published_idx").on(table.publishedAt)],
);

/** Per channel, so a Slack failure never blocks Discord. Retryable without re-announcing. */
export const deliveries = pgTable(
  "deliveries",
  {
    id: uuidPk(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    channel: deliveryChannelEnum("channel").notNull(),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    externalRef: text("external_ref"),
    error: text("error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("deliveries_announcement_channel_unique").on(table.announcementId, table.channel),
    index("deliveries_status_idx").on(table.status),
  ],
);
