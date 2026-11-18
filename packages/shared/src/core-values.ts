import { z } from "zod";

/**
 * Core values video assignment: each student picks ONE FIRST core value and uploads a video
 * of themselves talking about it (at least one minute). The video lives in the Team Shared
 * Drive and is referenced only by its Google file ID (AGENTS non-negotiable 3). These are the
 * wire contracts and the few pure rules both sides share.
 */

export const CORE_VALUE_KEYS = [
  "discovery",
  "innovation",
  "impact",
  "inclusion",
  "teamwork",
  "fun",
] as const;
export type CoreValueKey = (typeof CORE_VALUE_KEYS)[number];
export const coreValueKeySchema = z.enum(CORE_VALUE_KEYS);

export const SUBMISSION_STATUSES = ["uploaded", "approved", "needs_redo"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);

/** 1.5 GB. A phone video of a few minutes is far below this; it only stops runaway uploads. */
export const MAX_VIDEO_BYTES = 1.5 * 1024 * 1024 * 1024;
/** The assignment asks for at least one minute. */
export const MIN_VIDEO_SECONDS = 60;

export const uploadSessionRequestSchema = z.object({
  coreValue: coreValueKeySchema,
  fileName: z.string().trim().min(1).max(200),
  mimeType: z
    .string()
    .trim()
    .max(100)
    .refine((value) => value.toLowerCase().startsWith("video/"), "That file is not a video."),
  sizeBytes: z
    .number()
    .int()
    .positive("The file is empty.")
    .max(MAX_VIDEO_BYTES, "That video is larger than 1.5 GB."),
});
export type UploadSessionRequest = z.infer<typeof uploadSessionRequestSchema>;

export const uploadSessionResponseSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("ready"),
    uploadUrl: z.string().url(),
    submissionId: z.string().uuid(),
  }),
  z.object({ state: z.literal("not_configured") }),
]);
export type UploadSessionResponse = z.infer<typeof uploadSessionResponseSchema>;

export const createSubmissionRequestSchema = z.object({
  submissionId: z.string().uuid(),
  driveFileId: z
    .string()
    .trim()
    .min(10)
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/, "That is not a Drive file ID."),
});
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;

export const submissionSummarySchema = z.object({
  id: z.string().uuid(),
  coreValue: coreValueKeySchema,
  status: submissionStatusSchema,
  sizeBytes: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;

export const createSubmissionResponseSchema = z.object({
  ok: z.literal(true),
  submission: submissionSummarySchema,
});

/** Never carries the Drive link: students only see their own status. */
export const mySubmissionResponseSchema = z.object({
  /** True when the account has a claimed roster entry (the gate for submitting). */
  eligible: z.boolean(),
  /** True when a Drive parent folder is registered, so the in-app upload can work. */
  configured: z.boolean(),
  submission: submissionSummarySchema.nullable(),
});
export type MySubmissionResponse = z.infer<typeof mySubmissionResponseSchema>;

/* ----- admin ----- */

export const adminCoreValuesQuerySchema = z.object({
  status: submissionStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminCoreValuesQuery = z.infer<typeof adminCoreValuesQuerySchema>;

export const adminCoreValueRowSchema = submissionSummarySchema.extend({
  studentName: z.string(),
  driveFileId: z.string(),
  mimeType: z.string().nullable(),
});
export type AdminCoreValueRow = z.infer<typeof adminCoreValueRowSchema>;

export const adminCoreValuesResponseSchema = z.object({
  items: z.array(adminCoreValueRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  limit: z.number().int(),
});

export const adminCoreValuePatchSchema = z.object({
  status: z.enum(["approved", "needs_redo"]),
});
export type AdminCoreValuePatch = z.infer<typeof adminCoreValuePatchSchema>;

/**
 * The file name stored in Drive carries the value and the submission id but never a name:
 * identity stays in our database. `parseSubmissionFileName` is how the server ties a Drive
 * file back to the submission it was issued for.
 */
export function submissionFileName(coreValue: CoreValueKey, submissionId: string, ext: string) {
  return `${coreValue} - ${submissionId}${ext}`;
}

export function parseSubmissionFileName(
  name: string,
): { coreValue: CoreValueKey; submissionId: string } | null {
  const match = /^([a-z]+) - ([0-9a-f-]{36})(\.[A-Za-z0-9]{1,5})?$/.exec(name);
  if (!match) return null;
  const value = coreValueKeySchema.safeParse(match[1]);
  const id = z.string().uuid().safeParse(match[2]);
  if (!value.success || !id.success) return null;
  return { coreValue: value.data, submissionId: id.data };
}

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
  "video/3gpp": ".3gp",
};

/** A safe extension from the picked file's name, else from its MIME type, else none. */
export function videoExtension(fileName: string, mimeType: string): string {
  const fromName = /\.([A-Za-z0-9]{1,5})$/.exec(fileName.trim());
  if (fromName?.[1]) return `.${fromName[1].toLowerCase()}`;
  return EXT_BY_MIME[mimeType.toLowerCase()] ?? "";
}
