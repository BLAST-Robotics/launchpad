import { createTokenSource, GoogleApiError } from "./google-auth";

/**
 * The two Drive calls the core-values upload needs, over a service-account token (no SDK):
 * start a resumable upload session so the browser can send the bytes straight to Google, and
 * read back a file's metadata to verify what landed. The video never passes through this app,
 * and no file is ever made public or link-shared.
 */
export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  parents: string[];
  durationMs: number | null;
}

export interface DriveClient {
  /** Returns the resumable session URL the browser PUTs the file to. */
  createResumableSession(input: {
    parentId: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    /** The browser's Origin, so Google lets that page PUT to the session URL cross-origin. */
    origin: string | null;
  }): Promise<string>;
  /** Null when the file does not exist or the account cannot see it. */
  getFile(fileId: string): Promise<DriveFileInfo | null>;
}

const SCOPE = "https://www.googleapis.com/auth/drive";

export function createGoogleDriveClient(
  keyJson: string | undefined,
  fetchImpl: typeof fetch = fetch,
): DriveClient | null {
  // The service account acts as itself: it must be a member of the Team Shared Drive.
  const accessToken = createTokenSource({ keyJson, scope: SCOPE, fetchImpl });
  if (!accessToken) return null;

  return {
    async createResumableSession({ parentId, name, mimeType, sizeBytes, origin }) {
      const response = await fetchImpl(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await accessToken()}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
            "X-Upload-Content-Length": String(sizeBytes),
            ...(origin ? { Origin: origin } : {}),
          },
          body: JSON.stringify({ name, mimeType, parents: [parentId] }),
        },
      );
      if (!response.ok) throw new GoogleApiError("create upload session", response.status);
      const location = response.headers.get("location");
      if (!location) throw new GoogleApiError("create upload session", 502);
      return location;
    },

    async getFile(fileId) {
      const fields = "id,name,mimeType,size,parents,videoMediaMetadata(durationMillis)";
      const response = await fetchImpl(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          fileId,
        )}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
        { headers: { Authorization: `Bearer ${await accessToken()}` } },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new GoogleApiError("get file", response.status);
      const body = (await response.json()) as {
        id?: string;
        name?: string;
        mimeType?: string;
        size?: string;
        parents?: string[];
        videoMediaMetadata?: { durationMillis?: string };
      };
      if (!body.id || !body.name || !body.mimeType) return null;
      const size = body.size ? Number.parseInt(body.size, 10) : Number.NaN;
      const duration = body.videoMediaMetadata?.durationMillis
        ? Number.parseInt(body.videoMediaMetadata.durationMillis, 10)
        : Number.NaN;
      return {
        id: body.id,
        name: body.name,
        mimeType: body.mimeType,
        sizeBytes: Number.isFinite(size) ? size : null,
        parents: body.parents ?? [],
        durationMs: Number.isFinite(duration) ? duration : null,
      };
    },
  };
}
