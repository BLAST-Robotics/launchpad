import { db, schema } from "@launchpad/db";
import {
  type CoreValueKey,
  createSubmissionRequestSchema,
  createSubmissionResponseSchema,
  mySubmissionResponseSchema,
  type SubmissionStatus,
  type SubmissionSummary,
  UNAUTHENTICATED,
  uploadSessionRequestSchema,
  uploadSessionResponseSchema,
} from "@launchpad/shared";
import { and, desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { writeAudit } from "../audit";
import { auth } from "../auth";
import { env } from "../env";
import { HttpError } from "../http-error";
import { type CoreValuesDeps, startUpload, verifyUploadedFile } from "../lib/core-values";
import { createGoogleDriveClient } from "../lib/drive";
import { classifyGoogleError } from "../lib/google-auth";
import { logEvent } from "../observability";

const drive = createGoogleDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

/**
 * Where videos go: a dedicated folder if one is registered (`folder` / `core-values`), else the
 * Team Shared Drive root (`shared_drive` / `drives.team`). Both come from `google_objects`
 * (D-019); no Drive ID is ever in source.
 */
async function lookupParentId(): Promise<string | null> {
  const folder = await db.query.googleObjects.findFirst({
    where: and(
      eq(schema.googleObjects.kind, "folder"),
      eq(schema.googleObjects.key, "core-values"),
    ),
  });
  if (folder) return folder.externalId;
  const sharedDrive = await db.query.googleObjects.findFirst({
    where: and(
      eq(schema.googleObjects.kind, "shared_drive"),
      eq(schema.googleObjects.key, "drives.team"),
    ),
  });
  return sharedDrive?.externalId ?? null;
}

const deps: CoreValuesDeps = { drive, lookupParentId };

export function toSubmissionSummary(row: {
  id: string;
  coreValue: string;
  status: string;
  sizeBytes: number | null;
  durationMs: number | null;
  createdAt: Date;
}): SubmissionSummary {
  return {
    id: row.id,
    coreValue: row.coreValue as CoreValueKey,
    status: row.status as SubmissionStatus,
    sizeBytes: row.sizeBytes,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  };
}

async function currentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.user.id) });
  return user ?? null;
}

const notEligible = () =>
  new HttpError(
    403,
    "NOT_ELIGIBLE",
    "Claim your roster spot first. If you skipped it, ask an admin for help.",
  );

/**
 * Core values video assignment. The video goes browser -> Google Drive directly through a
 * resumable session this API creates; the API only stores the Drive file ID and a status.
 * Everything requires a session and a claimed roster entry. Students never receive a Drive
 * link, only their own submission status.
 */
export const coreValuesRoutes = new Elysia({ name: "core-values", prefix: "/api/core-values" })
  .get("/mine", async ({ request, set }) => {
    const user = await currentUser(request);
    if (!user) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    const [latest] = await db
      .select()
      .from(schema.coreValueSubmissions)
      .where(eq(schema.coreValueSubmissions.userId, user.id))
      .orderBy(desc(schema.coreValueSubmissions.createdAt))
      .limit(1);
    return mySubmissionResponseSchema.parse({
      eligible: user.rosterEntryId !== null,
      configured: drive !== null && (await lookupParentId()) !== null,
      submission: latest ? toSubmissionSummary(latest) : null,
    });
  })

  .post("/upload-session", async ({ request, body, set }) => {
    const user = await currentUser(request);
    if (!user) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    if (user.rosterEntryId === null) throw notEligible();

    const parsed = uploadSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Check the video and try again.",
      );
    }

    try {
      const result = await startUpload(deps, parsed.data, request.headers.get("origin"));
      if (result.state === "ready") {
        logEvent("core_values.upload_started", {
          userId: user.id,
          submissionId: result.submissionId,
        });
      }
      return uploadSessionResponseSchema.parse(result);
    } catch (error) {
      logEvent("core_values.upload_session_failed", {
        userId: user.id,
        reason: classifyGoogleError(error),
      });
      throw new HttpError(
        502,
        "UPLOAD_UNAVAILABLE",
        "We could not start the upload. Try again, or use the backup form.",
      );
    }
  })

  .post("/submissions", async ({ request, body, set }) => {
    const user = await currentUser(request);
    if (!user) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    if (user.rosterEntryId === null) throw notEligible();

    const parsed = createSubmissionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Check the request and try again.",
      );
    }

    let verified: Awaited<ReturnType<typeof verifyUploadedFile>>;
    try {
      verified = await verifyUploadedFile(deps, parsed.data);
    } catch (error) {
      logEvent("core_values.verify_failed", {
        userId: user.id,
        reason: classifyGoogleError(error),
      });
      throw new HttpError(502, "UPLOAD_UNAVAILABLE", "We could not check the upload. Try again.");
    }
    if (!verified.ok) {
      logEvent("core_values.verify_rejected", { userId: user.id, reason: verified.reason });
      if (verified.reason === "not_configured") {
        throw new HttpError(503, "NOT_CONFIGURED", "Video upload is not connected yet.");
      }
      if (verified.reason === "not_found") {
        throw new HttpError(404, "NOT_FOUND", "We could not find that upload. Try again.");
      }
      throw new HttpError(422, "UNEXPECTED_FILE", "That is not the video we were expecting.");
    }

    const { file, coreValue } = verified;
    const row = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(schema.coreValueSubmissions)
        .values({
          id: parsed.data.submissionId,
          userId: user.id,
          rosterEntryId: user.rosterEntryId,
          coreValue,
          driveFileId: file.id,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          durationMs: file.durationMs,
        })
        .onConflictDoNothing({ target: schema.coreValueSubmissions.id })
        .returning();
      const created = inserted[0];
      if (created) {
        await writeAudit(tx, {
          actorUserId: user.id,
          action: "core_value.submitted",
          entity: "core_value_submission",
          entityId: created.id,
          after: { coreValue, status: "uploaded" },
        });
        return created;
      }
      // A repeat of the same request is a no-op; someone else's id is a conflict.
      const [existing] = await tx
        .select()
        .from(schema.coreValueSubmissions)
        .where(eq(schema.coreValueSubmissions.id, parsed.data.submissionId))
        .limit(1);
      if (!existing || existing.userId !== user.id) {
        throw new HttpError(409, "CONFLICT", "That submission could not be saved.");
      }
      return existing;
    });

    logEvent("core_values.submitted", { userId: user.id, submissionId: row.id });
    return createSubmissionResponseSchema.parse({ ok: true, submission: toSubmissionSummary(row) });
  });
