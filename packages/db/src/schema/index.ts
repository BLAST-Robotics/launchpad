import { relations } from "drizzle-orm";
import { attendanceRecords } from "./attendance";
import { accounts, sessions, users } from "./auth";
import { announcements, deliveries, events } from "./comms";
import { auditLog, googleObjects, provisioningState } from "./google";
import { guardianLinks, rosterEntries, seasons, subteamMembers, subteams } from "./roster";
import { waiverDocuments, waiverSignatures } from "./waivers";

export * from "./attendance";
export * from "./auth";
export * from "./comms";
export * from "./core-values";
export * from "./enums";
export * from "./google";
export * from "./roster";
export * from "./waivers";

/**
 * Relations exist for the relational query API used from Phase 1. Foreign keys are the
 * source of truth; these only declare how to traverse them.
 */
export const usersRelations = relations(users, ({ one, many }) => ({
  rosterEntry: one(rosterEntries, {
    fields: [users.rosterEntryId],
    references: [rosterEntries.id],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  guardianLinks: many(guardianLinks),
  waiverSignatures: many(waiverSignatures),
  provisioningState: one(provisioningState, {
    fields: [users.id],
    references: [provisioningState.userId],
  }),
  auditActions: many(auditLog),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const seasonsRelations = relations(seasons, ({ many }) => ({
  rosterEntries: many(rosterEntries),
  subteams: many(subteams),
  waiverDocuments: many(waiverDocuments),
}));

export const rosterEntriesRelations = relations(rosterEntries, ({ one, many }) => ({
  season: one(seasons, {
    fields: [rosterEntries.seasonId],
    references: [seasons.id],
  }),
  claimedBy: one(users, {
    fields: [rosterEntries.claimedByUserId],
    references: [users.id],
  }),
  guardianLinks: many(guardianLinks),
  subteamMembers: many(subteamMembers),
  attendanceRecords: many(attendanceRecords),
}));

export const guardianLinksRelations = relations(guardianLinks, ({ one }) => ({
  user: one(users, { fields: [guardianLinks.userId], references: [users.id] }),
  rosterEntry: one(rosterEntries, {
    fields: [guardianLinks.rosterEntryId],
    references: [rosterEntries.id],
  }),
}));

export const subteamsRelations = relations(subteams, ({ one, many }) => ({
  season: one(seasons, { fields: [subteams.seasonId], references: [seasons.id] }),
  mentor: one(users, { fields: [subteams.mentorId], references: [users.id] }),
  members: many(subteamMembers),
}));

export const subteamMembersRelations = relations(subteamMembers, ({ one }) => ({
  subteam: one(subteams, {
    fields: [subteamMembers.subteamId],
    references: [subteams.id],
  }),
  rosterEntry: one(rosterEntries, {
    fields: [subteamMembers.rosterEntryId],
    references: [rosterEntries.id],
  }),
}));

export const waiverDocumentsRelations = relations(waiverDocuments, ({ one, many }) => ({
  season: one(seasons, {
    fields: [waiverDocuments.seasonId],
    references: [seasons.id],
  }),
  signatures: many(waiverSignatures),
}));

export const waiverSignaturesRelations = relations(waiverSignatures, ({ one }) => ({
  document: one(waiverDocuments, {
    fields: [waiverSignatures.waiverDocumentId],
    references: [waiverDocuments.id],
  }),
  user: one(users, { fields: [waiverSignatures.userId], references: [users.id] }),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  rosterEntry: one(rosterEntries, {
    fields: [attendanceRecords.rosterEntryId],
    references: [rosterEntries.id],
  }),
  recordedByUser: one(users, {
    fields: [attendanceRecords.recordedBy],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  creator: one(users, { fields: [announcements.createdBy], references: [users.id] }),
  deliveries: many(deliveries),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  announcement: one(announcements, {
    fields: [deliveries.announcementId],
    references: [announcements.id],
  }),
}));

export const googleObjectsRelations = relations(googleObjects, () => ({}));

export const provisioningStateRelations = relations(provisioningState, ({ one }) => ({
  user: one(users, { fields: [provisioningState.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorUserId], references: [users.id] }),
}));
