import { z } from "zod";
import type { Role } from "./roles";

/**
 * Waiver status is DERIVED, never stored (AGENTS non-negotiable 5): required active waiver
 * documents for the person's roles, intersected with the signature rows that exist.
 * Pure function: no database, no framework.
 */

export const WAIVER_STATUSES = [
  "signed",
  "self_reported",
  "signed_assumed",
  "missing",
  "not_required",
] as const;
export type WaiverStatus = (typeof WAIVER_STATUSES)[number];
export const waiverStatusSchema = z.enum(WAIVER_STATUSES);

export const DUES_STATUSES = ["paid", "unpaid", "unknown"] as const;
export type DuesStatus = (typeof DUES_STATUSES)[number];
export const duesStatusSchema = z.enum(DUES_STATUSES);

export type SignatureSource = "keysign" | "self_reported";

export interface RequiredWaiver {
  id: string;
  /** Empty means everyone; otherwise the roles the waiver applies to. */
  audienceRoles: readonly Role[];
  isRequired: boolean;
}

export interface SignatureRecord {
  waiverDocumentId: string;
  source: SignatureSource;
}

export interface WaiverStatusInput {
  roles: readonly Role[];
  documents: readonly RequiredWaiver[];
  signatures: readonly SignatureRecord[];
  /**
   * Temporary switch (D-022). When true, a person who is on the roster (or a guardian of
   * someone who is) and has no signature is shown as "signed_assumed", never as signed.
   */
  assumedSigned: boolean;
  /** True when the person has a claimed roster entry or a linked child. */
  onRoster: boolean;
}

export interface WaiverStatusResult {
  status: WaiverStatus;
  missingDocumentIds: string[];
}

export function waiverStatus(input: WaiverStatusInput): WaiverStatusResult {
  const roles = new Set(input.roles);
  const applicable = input.documents.filter(
    (doc) =>
      doc.isRequired &&
      (doc.audienceRoles.length === 0 || doc.audienceRoles.some((role) => roles.has(role))),
  );
  if (applicable.length === 0) return { status: "not_required", missingDocumentIds: [] };

  // A KeySign signature beats a self-report for the same document.
  const bySigned = new Map<string, SignatureSource>();
  for (const s of input.signatures) {
    if (bySigned.get(s.waiverDocumentId) !== "keysign") bySigned.set(s.waiverDocumentId, s.source);
  }
  const missing = applicable.filter((doc) => !bySigned.has(doc.id)).map((doc) => doc.id);

  if (missing.length === 0) {
    const anySelfReported = applicable.some((doc) => bySigned.get(doc.id) === "self_reported");
    return { status: anySelfReported ? "self_reported" : "signed", missingDocumentIds: [] };
  }
  if (input.assumedSigned && input.onRoster) {
    return { status: "signed_assumed", missingDocumentIds: missing };
  }
  return { status: "missing", missingDocumentIds: missing };
}

/** Plain-language label + the next step, for the dashboard. */
export function describeWaiver(status: WaiverStatus): { label: string; detail: string } {
  switch (status) {
    case "signed":
      return { label: "Signed", detail: "Your waiver is on file." };
    case "self_reported":
      return {
        label: "Signed (you told us)",
        detail: "You said you filled it out. A mentor will check it.",
      };
    case "signed_assumed":
      return {
        label: "Signed (assumed for now)",
        detail: "We are treating everyone on the roster as signed until e-sign is connected.",
      };
    case "missing":
      return { label: "Not signed yet", detail: "Fill out the waiver form to finish." };
    case "not_required":
      return { label: "Nothing to sign", detail: "No waiver is needed for you right now." };
  }
}

export function describeDues(status: DuesStatus): { label: string; detail: string } {
  switch (status) {
    case "paid":
      return { label: "Paid", detail: "Dues are paid. Thank you." };
    case "unpaid":
      return {
        label: "Not paid yet",
        detail: "Dues are not marked as paid. If you already paid, write to admin@team10989.org.",
      };
    case "unknown":
      return {
        label: "Not checked yet",
        detail: "We do not have a dues record for you yet. Write to admin@team10989.org.",
      };
  }
}

/** The metadata KeySign carries on a signing link and echoes back in the webhook. */
export const keysignMetadataSchema = z.object({
  launchpadUserId: z.string().uuid(),
  waiverDocumentId: z.string().uuid(),
  signerRole: z.enum(["student", "guardian"]).optional(),
});
export type KeysignMetadata = z.infer<typeof keysignMetadataSchema>;

/** Webhook payload from KeySign (see docs/KEYSIGN-INTEGRATION.md). */
export const keysignWebhookSchema = z.object({
  event: z.literal("document.completed"),
  signatureId: z.string().min(1).max(200),
  completedAt: z.string().datetime({ offset: true }),
  pdfDriveId: z.string().max(200).optional(),
  metadata: keysignMetadataSchema,
});
export type KeysignWebhook = z.infer<typeof keysignWebhookSchema>;

/** `GET /api/waivers/signing`: what the /waivers page needs to show the e-sign iframe. */
export const signingResponseSchema = z.object({
  connected: z.boolean(),
  url: z.string().nullable(),
  documentName: z.string().nullable(),
  documentId: z.string().uuid().nullable(),
  status: waiverStatusSchema,
});
export type SigningResponse = z.infer<typeof signingResponseSchema>;

/** `POST /api/waivers/self-report` */
export const selfReportResponseSchema = z.object({
  ok: z.literal(true),
  outcome: z.enum(["recorded", "already_recorded"]),
});
