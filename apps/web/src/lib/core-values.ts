import {
  type CoreValueKey,
  createSubmissionResponseSchema,
  mySubmissionResponseSchema,
  uploadSessionResponseSchema,
} from "@launchpad/shared";
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./api";

/** The signed-in person's own core-values status: eligibility, whether upload is connected, latest video. */
export const mySubmissionQuery = queryOptions({
  queryKey: ["core-values", "mine"],
  queryFn: () => apiFetch("/api/core-values/mine", mySubmissionResponseSchema),
});

export const startUploadSession = (input: {
  coreValue: CoreValueKey;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) =>
  apiFetch("/api/core-values/upload-session", uploadSessionResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const recordSubmission = (input: { submissionId: string; driveFileId: string }) =>
  apiFetch("/api/core-values/submissions", createSubmissionResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

/**
 * Length of a video file in seconds, read in the browser with a <video> element.
 * Null when the browser cannot read it (some phone codecs): the caller then lets it through
 * and the admin sees the real length once Drive has processed the file.
 */
export function readVideoDuration(file: File, timeoutMs = 6000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

const CHUNK = 8 * 1024 * 1024; // a multiple of 256 KiB, as Drive requires
const MAX_ATTEMPTS = 4;

export interface UploadHandle {
  /** Resolves with the Drive file ID once Google has the whole file. */
  done: Promise<string>;
  cancel(): void;
}

export class UploadCancelled extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelled";
  }
}

/**
 * Resumable upload straight to Google Drive: the bytes never touch our server. Sends the file
 * in 8 MB chunks, reports smooth progress, retries a failed chunk, and can be cancelled.
 */
export function uploadToDrive(
  uploadUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): UploadHandle {
  let cancelled = false;
  let active: XMLHttpRequest | null = null;

  const sendChunk = (start: number, end: number) =>
    new Promise<{ status: number; body: string; range: string | null }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      active = xhr;
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end}/${file.size}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.min(1, (start + event.loaded) / file.size));
      };
      xhr.onload = () =>
        resolve({
          status: xhr.status,
          body: xhr.responseText,
          range: xhr.getResponseHeader("Range"),
        });
      xhr.onerror = () => reject(new Error("network"));
      xhr.onabort = () => reject(new UploadCancelled());
      xhr.send(file.slice(start, end + 1));
    });

  const done = (async () => {
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + CHUNK, file.size) - 1;
      let result: { status: number; body: string; range: string | null } | null = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (cancelled) throw new UploadCancelled();
        try {
          result = await sendChunk(offset, end);
          if (result.status === 200 || result.status === 201 || result.status === 308) break;
          result = null;
        } catch (error) {
          if (error instanceof UploadCancelled) throw error;
        }
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
      if (!result) throw new Error("upload failed");

      if (result.status === 200 || result.status === 201) {
        onProgress(1);
        const parsed = JSON.parse(result.body) as { id?: string };
        if (!parsed.id) throw new Error("upload finished without a file id");
        return parsed.id;
      }
      // 308: Drive has the bytes so far. Prefer what it reports; else assume the chunk landed.
      const reported = result.range ? /bytes=0-(\d+)/.exec(result.range)?.[1] : undefined;
      offset = reported ? Number.parseInt(reported, 10) + 1 : end + 1;
      onProgress(offset / file.size);
    }
    throw new Error("upload ended early");
  })();

  return {
    done,
    cancel() {
      cancelled = true;
      active?.abort();
      // Best effort: tell Drive to drop the half-finished upload.
      void fetch(uploadUrl, { method: "DELETE" }).catch(() => undefined);
    },
  };
}
