import { MAX_VIDEO_BYTES, MIN_VIDEO_SECONDS } from "@launchpad/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CORE_VALUES_FALLBACK_FORM, type CoreValue } from "../content/core-values";
import {
  mySubmissionQuery,
  readVideoDuration,
  recordSubmission,
  startUploadSession,
  UploadCancelled,
  type UploadHandle,
  uploadToDrive,
} from "../lib/core-values";
import { Alert, Button, linkClass } from "./ui";

type Phase = "idle" | "checking" | "ready" | "uploading" | "saving" | "done" | "error";

const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/**
 * Pick a video, check it is long enough, send it straight to the team's Google Drive, then
 * record it. The video never goes through our server. Every failure has a way forward: try
 * again, or use the assignment's backup form.
 */
export function CoreValueUpload({ value }: { value: CoreValue }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const handle = useRef<UploadHandle | null>(null);

  function reset() {
    setPhase("idle");
    setFile(null);
    setSeconds(null);
    setProgress(0);
    setMessage(null);
  }

  async function onPick(picked: File | undefined) {
    if (!picked) return;
    setMessage(null);
    if (!picked.type.toLowerCase().startsWith("video/")) {
      setPhase("error");
      setMessage("That file is not a video. Pick the video you recorded.");
      return;
    }
    if (picked.size > MAX_VIDEO_BYTES) {
      setPhase("error");
      setMessage(
        "That video is bigger than 1.5 GB. Record it again at a lower quality (360p is plenty).",
      );
      return;
    }
    setPhase("checking");
    const length = await readVideoDuration(picked);
    if (length !== null && length < MIN_VIDEO_SECONDS) {
      setPhase("error");
      setMessage(
        `Your video is ${clock(length)} long. It needs to be at least 1:00, so talk a bit longer and try again.`,
      );
      return;
    }
    setFile(picked);
    setSeconds(length);
    setPhase("ready");
  }

  async function onUpload() {
    if (!file) return;
    setMessage(null);
    setProgress(0);
    setPhase("uploading");
    try {
      const session = await startUploadSession({
        coreValue: value.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (session.state === "not_configured") {
        setPhase("error");
        setMessage("Video upload is not connected yet. Please use the backup form.");
        return;
      }
      handle.current = uploadToDrive(session.uploadUrl, file, setProgress);
      const driveFileId = await handle.current.done;
      setPhase("saving");
      await recordSubmission({ submissionId: session.submissionId, driveFileId });
      await queryClient.invalidateQueries({ queryKey: mySubmissionQuery.queryKey });
      setPhase("done");
    } catch (error) {
      if (error instanceof UploadCancelled) {
        setPhase("ready");
        setProgress(0);
        return;
      }
      setPhase("error");
      setMessage(
        error instanceof Error && error.message && !/^(network|upload)/i.test(error.message)
          ? error.message
          : "The upload did not finish. Check your connection and try again, or use the backup form.",
      );
    } finally {
      handle.current = null;
    }
  }

  if (phase === "done") {
    return (
      <div className="rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success">
        <p className="font-semibold">Got it. Your {value.title} video is in.</p>
        <p className="mt-1">A mentor will take a look. You don't need to do anything else.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
          Upload a different video
        </Button>
      </div>
    );
  }

  const busy = phase === "checking" || phase === "uploading" || phase === "saving";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Record yourself talking about <strong className="text-primary">{value.title}</strong> for at
        least 1 minute. A 360p phone recording is plenty: it keeps the file small (about 15 to 40 MB
        for 1 to 3 minutes).
      </p>

      <div>
        <label htmlFor="core-value-video" className="block text-sm font-medium">
          Your video
        </label>
        <input
          id="core-value-video"
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(event) => void onPick(event.target.files?.[0])}
          className="mt-1.5 block min-h-11 w-full rounded-lg border border-strong bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </div>

      {phase === "checking" ? <p className="text-sm text-muted">Checking your video…</p> : null}

      {file && (phase === "ready" || phase === "uploading" || phase === "saving") ? (
        <p className="text-sm">
          {file.name} · {mb(file.size)}
          {seconds !== null ? ` · ${clock(seconds)}` : " · length will be checked after upload"}
        </p>
      ) : null}

      {phase === "uploading" || phase === "saving" ? (
        <div>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-3 overflow-hidden rounded-full bg-subtle"
          >
            <div className="fire-bar h-full" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-sm text-muted" aria-live="polite">
            {phase === "saving" ? "Saving…" : `Uploading… ${Math.round(progress * 100)}%`}
          </p>
        </div>
      ) : null}

      {phase === "error" && message ? (
        <Alert>
          <p>{message}</p>
          <p className="mt-1">
            Still stuck? Use the{" "}
            <a
              className={linkClass}
              href={CORE_VALUES_FALLBACK_FORM}
              target="_blank"
              rel="noreferrer"
            >
              backup form
            </a>
            .
          </p>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {phase === "ready" ? (
          <Button size="lg" onClick={() => void onUpload()}>
            Upload my video
          </Button>
        ) : null}
        {phase === "uploading" ? (
          <Button variant="secondary" size="lg" onClick={() => handle.current?.cancel()}>
            Cancel
          </Button>
        ) : null}
        {phase === "error" && file ? (
          <Button size="lg" onClick={() => void onUpload()}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
