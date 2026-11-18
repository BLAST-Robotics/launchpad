import { randomUUID } from "node:crypto";
import {
  type CoreValueKey,
  parseSubmissionFileName,
  submissionFileName,
  type UploadSessionRequest,
  videoExtension,
} from "@launchpad/shared";
import type { DriveClient, DriveFileInfo } from "./drive";

/**
 * Core-values upload logic with the Drive calls and the folder lookup injected, so it is
 * testable without Google or the database. The route wires in the real ones.
 */
export interface CoreValuesDeps {
  drive: DriveClient | null;
  /** The Drive folder (or Shared Drive root) videos go in, from `google_objects`; null if unset. */
  lookupParentId(): Promise<string | null>;
  newId?: () => string;
}

export type StartUploadResult =
  | { state: "ready"; uploadUrl: string; submissionId: string }
  | { state: "not_configured" };

export async function startUpload(
  deps: CoreValuesDeps,
  input: UploadSessionRequest,
  origin: string | null,
): Promise<StartUploadResult> {
  if (!deps.drive) return { state: "not_configured" };
  const parentId = await deps.lookupParentId();
  if (!parentId) return { state: "not_configured" };

  const submissionId = (deps.newId ?? randomUUID)();
  // The student's name never goes in the Drive file name; identity stays in our database.
  const name = submissionFileName(
    input.coreValue,
    submissionId,
    videoExtension(input.fileName, input.mimeType),
  );
  const uploadUrl = await deps.drive.createResumableSession({
    parentId,
    name,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    origin,
  });
  return { state: "ready", uploadUrl, submissionId };
}

export type VerifyResult =
  | {
      ok: true;
      coreValue: CoreValueKey;
      file: DriveFileInfo;
    }
  | {
      ok: false;
      reason: "not_configured" | "not_found" | "not_video" | "wrong_folder" | "wrong_submission";
    };

/** Confirms the Drive file is the video this submission id was issued for, in the right folder. */
export async function verifyUploadedFile(
  deps: CoreValuesDeps,
  input: { submissionId: string; driveFileId: string },
): Promise<VerifyResult> {
  if (!deps.drive) return { ok: false, reason: "not_configured" };
  const parentId = await deps.lookupParentId();
  if (!parentId) return { ok: false, reason: "not_configured" };

  const file = await deps.drive.getFile(input.driveFileId);
  if (!file) return { ok: false, reason: "not_found" };
  if (!file.mimeType.toLowerCase().startsWith("video/")) return { ok: false, reason: "not_video" };
  if (!file.parents.includes(parentId)) return { ok: false, reason: "wrong_folder" };

  const parsed = parseSubmissionFileName(file.name);
  if (!parsed || parsed.submissionId !== input.submissionId) {
    return { ok: false, reason: "wrong_submission" };
  }
  return { ok: true, coreValue: parsed.coreValue, file };
}
