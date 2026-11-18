import { db, schema } from "@launchpad/db";
import {
  type DuesStatus,
  type RequiredWaiver,
  type Role,
  type SignatureRecord,
  type WaiverStatus,
  waiverStatus,
} from "@launchpad/shared";
import { and, eq, inArray } from "drizzle-orm";
import { env } from "../env";

/** Active required waivers for a season (ARCHITECTURE §5: derived, never a column). */
export async function activeWaivers(seasonId: string): Promise<RequiredWaiver[]> {
  const rows = await db.query.waiverDocuments.findMany({
    where: and(
      eq(schema.waiverDocuments.seasonId, seasonId),
      eq(schema.waiverDocuments.isRequired, true),
    ),
  });
  return rows.map((row) => ({
    id: row.id,
    audienceRoles: row.audienceRoles as Role[],
    isRequired: row.isRequired,
  }));
}

export async function signaturesFor(userIds: readonly string[]): Promise<SignatureRecord[]> {
  if (userIds.length === 0) return [];
  const rows = await db.query.waiverSignatures.findMany({
    where: inArray(schema.waiverSignatures.userId, [...userIds]),
  });
  return rows.map((row) => ({
    waiverDocumentId: row.waiverDocumentId,
    source: row.source === "self_reported" ? "self_reported" : "keysign",
  }));
}

export async function currentSeasonId(): Promise<string | null> {
  const season = await db.query.seasons.findFirst({
    where: eq(schema.seasons.isCurrent, true),
  });
  return season?.id ?? null;
}

/**
 * Waiver status for one roster entry: signatures by whoever claimed it or is linked to it
 * count (one KeySign document has a Student and a Parent/Guardian field, D-009).
 */
export async function waiverStatusForEntry(
  seasonId: string,
  entryId: string,
  claimedByUserId: string | null,
): Promise<WaiverStatus> {
  const links = await db.query.guardianLinks.findMany({
    where: eq(schema.guardianLinks.rosterEntryId, entryId),
  });
  const userIds = [claimedByUserId, ...links.map((l) => l.userId)].filter(
    (id): id is string => id !== null,
  );
  const [documents, signatures] = await Promise.all([
    activeWaivers(seasonId),
    signaturesFor(userIds),
  ]);
  return waiverStatus({
    roles: ["student"],
    documents,
    signatures,
    assumedSigned: env.WAIVERS_ASSUMED_SIGNED,
    onRoster: true,
  }).status;
}

export function asDues(value: string): DuesStatus {
  return value === "paid" || value === "unpaid" ? value : "unknown";
}
