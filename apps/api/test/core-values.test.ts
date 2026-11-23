import { describe, expect, test } from "bun:test";
import {
  MAX_VIDEO_BYTES,
  parseSubmissionFileName,
  submissionFileName,
  uploadSessionRequestSchema,
  videoExtension,
} from "@launchpad/shared";
import { createApp } from "../src/app";
import { type CoreValuesDeps, startUpload, verifyUploadedFile } from "../src/lib/core-values";
import type { DriveClient, DriveFileInfo } from "../src/lib/drive";

const ID = "6f1f8a52-2f5c-4f0e-9b1d-0b6d6c1d7a11";
const PARENT = "folder-123";

function fakeDrive(file: Partial<DriveFileInfo> | null) {
  const calls: Array<{ name: string; parentId: string; origin: string | null }> = [];
  const drive: DriveClient = {
    async createResumableSession(input) {
      calls.push({ name: input.name, parentId: input.parentId, origin: input.origin });
      return "https://upload.example.test/session/abc";
    },
    async getFile() {
      return file
        ? {
            id: "file-abc-123456",
            name: submissionFileName("teamwork", ID, ".mp4"),
            mimeType: "video/mp4",
            sizeBytes: 1000,
            parents: [PARENT],
            durationMs: 75_000,
            ...file,
          }
        : null;
    },
  };
  return { drive, calls };
}

const request = {
  coreValue: "teamwork",
  fileName: "My Video.MOV",
  mimeType: "video/quicktime",
  sizeBytes: 5000,
} as const;

describe("upload-session request validation", () => {
  test("accepts a normal video", () => {
    expect(uploadSessionRequestSchema.safeParse(request).success).toBe(true);
  });
  test("rejects a non-video, an unknown value, an empty file and an oversize file", () => {
    expect(
      uploadSessionRequestSchema.safeParse({ ...request, mimeType: "image/png" }).success,
    ).toBe(false);
    expect(uploadSessionRequestSchema.safeParse({ ...request, coreValue: "winning" }).success).toBe(
      false,
    );
    expect(uploadSessionRequestSchema.safeParse({ ...request, sizeBytes: 0 }).success).toBe(false);
    expect(
      uploadSessionRequestSchema.safeParse({ ...request, sizeBytes: MAX_VIDEO_BYTES + 1 }).success,
    ).toBe(false);
  });
});

describe("file name contract", () => {
  test("round-trips and never contains a person's name", () => {
    const name = submissionFileName("fun", ID, ".mp4");
    expect(name).toBe(`fun - ${ID}.mp4`);
    expect(parseSubmissionFileName(name)).toEqual({ coreValue: "fun", submissionId: ID });
  });
  test("rejects anything that is not the issued shape", () => {
    expect(parseSubmissionFileName("holiday.mp4")).toBeNull();
    expect(parseSubmissionFileName(`winning - ${ID}.mp4`)).toBeNull();
    expect(parseSubmissionFileName(`fun - not-a-uuid.mp4`)).toBeNull();
  });
  test("extension comes from the file name, else the MIME type, else nothing", () => {
    expect(videoExtension("a.MOV", "video/quicktime")).toBe(".mov");
    expect(videoExtension("clip", "video/mp4")).toBe(".mp4");
    expect(videoExtension("clip", "video/unknown")).toBe("");
  });
});

describe("startUpload", () => {
  const base = (drive: DriveClient | null, parent: string | null): CoreValuesDeps => ({
    drive,
    lookupParentId: async () => parent,
    newId: () => ID,
  });

  test("not_configured without a Drive client or without a registered folder", async () => {
    expect(await startUpload(base(null, PARENT), request, null)).toEqual({
      state: "not_configured",
    });
    expect(await startUpload(base(fakeDrive(null).drive, null), request, null)).toEqual({
      state: "not_configured",
    });
  });

  test("ready: names the file by value and id, uses the folder, passes the Origin", async () => {
    const { drive, calls } = fakeDrive(null);
    const result = await startUpload(base(drive, PARENT), request, "https://app.example.test");
    expect(result).toEqual({
      state: "ready",
      uploadUrl: "https://upload.example.test/session/abc",
      submissionId: ID,
    });
    expect(calls[0]).toEqual({
      name: `teamwork - ${ID}.mov`,
      parentId: PARENT,
      origin: "https://app.example.test",
    });
  });
});

describe("verifyUploadedFile", () => {
  const deps = (drive: DriveClient | null, parent: string | null = PARENT): CoreValuesDeps => ({
    drive,
    lookupParentId: async () => parent,
  });
  const input = { submissionId: ID, driveFileId: "file-abc-123456" };

  test("ok for the issued video in the right folder", async () => {
    const result = await verifyUploadedFile(deps(fakeDrive({}).drive), input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.coreValue).toBe("teamwork");
      expect(result.file.durationMs).toBe(75_000);
    }
  });

  test("rejects each wrong shape with a distinct reason", async () => {
    expect(await verifyUploadedFile(deps(null), input)).toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(await verifyUploadedFile(deps(fakeDrive({}).drive, null), input)).toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(await verifyUploadedFile(deps(fakeDrive(null).drive), input)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(
      await verifyUploadedFile(deps(fakeDrive({ mimeType: "image/png" }).drive), input),
    ).toEqual({
      ok: false,
      reason: "not_video",
    });
    expect(
      await verifyUploadedFile(deps(fakeDrive({ parents: ["elsewhere"] }).drive), input),
    ).toEqual({
      ok: false,
      reason: "wrong_folder",
    });
    expect(
      await verifyUploadedFile(deps(fakeDrive({ name: `fun - ${ID}.mp4` }).drive), {
        ...input,
        submissionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({ ok: false, reason: "wrong_submission" });
  });
});

describe("core values routes", () => {
  const app = createApp();
  const call = (path: string, init?: RequestInit) =>
    app.handle(new Request(`http://localhost${path}`, init));
  const post = (path: string, body: unknown) =>
    call(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  test("every route is 401 without a session", async () => {
    expect((await call("/api/core-values/mine")).status).toBe(401);
    expect((await post("/api/core-values/upload-session", request)).status).toBe(401);
    expect(
      (
        await post("/api/core-values/submissions", {
          submissionId: ID,
          driveFileId: "file-abc-123456",
        })
      ).status,
    ).toBe(401);
  });

  test("admin core-values routes are 401 without a session", async () => {
    expect((await call("/api/admin/core-values")).status).toBe(401);
    expect(
      (
        await call(`/api/admin/core-values/${ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        })
      ).status,
    ).toBe(401);
  });
});
