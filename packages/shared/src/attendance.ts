/**
 * Attendance seam.
 *
 * LaunchPad owns the roster (DECISIONS D-006); attendance flows *into* LaunchPad.
 * Phase 0 only ships the interface so the seam exists before LancerLogin does.
 * Implementations (`manual`, `csv`) arrive in Phase 3; `attendance_system` after that.
 */

export const ATTENDANCE_SOURCES = ["manual", "csv", "attendance_system"] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

export const ATTENDANCE_DIRECTIONS = ["in", "out"] as const;
export type AttendanceDirection = (typeof ATTENDANCE_DIRECTIONS)[number];

export interface AttendanceRecordInput {
  rosterEntryId: string;
  source: AttendanceSource;
  direction: AttendanceDirection;
  happenedAt: string;
  sessionRef?: string | null;
  minutes?: number | null;
  raw?: unknown;
  recordedBy?: string | null;
}

export interface AttendanceHours {
  rosterEntryId: string;
  from: string;
  to: string;
  minutes: number;
  sessions: number;
}

/** A mentor typing hours by hand. `recordedBy` is required. */
export interface ManualEntry extends AttendanceRecordInput {
  source: "manual";
  recordedBy: string;
  minutes: number;
}

/** One parsed row of a CSV import. Unknown columns stay in `raw`. */
export interface CsvImportRow extends AttendanceRecordInput {
  source: "csv";
}

export interface CsvImport {
  filename: string;
  importedBy: string;
  rows: CsvImportRow[];
}

export interface AttendanceCapabilities {
  /** Whether a human can enter hours in the portal. */
  manualEntry: boolean;
  /** Whether hours can be imported from a file. */
  csvImport: boolean;
  /** Whether the provider can enable/disable a shop badge. */
  badge: boolean;
  /** Whether the provider pushes records to LaunchPad on its own. */
  push: boolean;
}

/** The contracts the future attendance system must satisfy (ARCHITECTURE §8). */
export interface AttendanceProvider {
  readonly name: string;
  readonly capabilities: AttendanceCapabilities;
  listHours(rosterEntryId: string, from: string, to: string): Promise<AttendanceHours>;
  pushMember(member: { launchpadId: string; displayName: string }): Promise<void>;
  setBadge(rosterEntryId: string, enabled: boolean): Promise<void>;
}
