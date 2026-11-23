import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Postgres enums for closed sets that appear in the data model.
 * Values are duplicated here rather than imported from @launchpad/shared so the
 * database package stays dependency-free; `db:check` and typecheck catch drift.
 */
export const roleEnum = pgEnum("role", ["pending", "student", "parent", "mentor", "admin"]);

export const memberStatusEnum = pgEnum("member_status", ["active", "alumni", "archived"]);

export const rosterStatusEnum = pgEnum("roster_status", [
  "unclaimed",
  "claimed",
  "alumni",
  "archived",
]);

export const attendanceSourceEnum = pgEnum("attendance_source", [
  "manual",
  "csv",
  "attendance_system",
]);

export const attendanceDirectionEnum = pgEnum("attendance_direction", ["in", "out"]);

export const deliveryChannelEnum = pgEnum("delivery_channel", ["slack", "discord", "portal"]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const googleObjectKindEnum = pgEnum("google_object_kind", [
  "group",
  "shared_drive",
  "folder",
  "calendar",
]);
