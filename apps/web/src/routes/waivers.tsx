import {
  describeWaiver,
  selfReportResponseSchema,
  signingResponseSchema,
  type WaiverStatus,
} from "@launchpad/shared";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Card, Pill, Spinner } from "../components/ui";
import { ApiError, apiFetch, meQueryOptions } from "../lib/api";

const HELP = "admin@team10989.org";

const signingQueryOptions = queryOptions({
  queryKey: ["waivers", "signing"],
  queryFn: () => apiFetch("/api/waivers/signing", signingResponseSchema),
});

const TONE: Record<WaiverStatus, "success" | "warning" | "neutral"> = {
  signed: "success",
  self_reported: "warning",
  signed_assumed: "neutral",
  missing: "warning",
  not_required: "neutral",
};

export function WaiversPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(signingQueryOptions);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  // An embed that refuses to be framed never fires `load` with usable content, and the page
  // cannot see inside it, so after a few seconds offer the new-tab route as well.
  useEffect(() => {
    if (!data?.url) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [data?.url]);

  const selfReport = useMutation({
    mutationFn: () =>
      apiFetch("/api/waivers/self-report", selfReportResponseSchema, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: signingQueryOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey }),
      ]);
    },
  });

  if (isPending) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <Spinner />
        <span>Loading the waiver…</span>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card>
        <h1 className="text-2xl">Waiver</h1>
        <p className="mt-3 text-sm text-muted">
          We could not load the waiver. Try again in a minute, or write to{" "}
          <a className="font-medium underline underline-offset-4" href={`mailto:${HELP}`}>
            {HELP}
          </a>
          .
        </p>
      </Card>
    );
  }

  const text = describeWaiver(data.status);
  const done = data.status === "signed" || data.status === "not_required";
  const errorMessage =
    selfReport.error instanceof ApiError
      ? selfReport.error.message
      : selfReport.error
        ? "That did not work. Try again."
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl">Waiver</h1>
        <p className="mt-2 max-w-prose text-muted">
          {data.documentName ?? "The team waiver"}. One form with a spot for the student and a spot
          for a parent or guardian.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Pill tone={TONE[data.status]}>{text.label}</Pill>
          <span className="text-sm text-muted">{text.detail}</span>
        </div>
      </div>

      {data.connected && data.url ? (
        <Card className="p-0">
          <div className="relative">
            {!frameLoaded ? (
              <div className="absolute inset-0 flex items-center justify-center gap-3 text-sm text-muted">
                <Spinner />
                <span>Loading the form…</span>
              </div>
            ) : null}
            <iframe
              title={data.documentName ?? "Team waiver form"}
              src={data.url}
              onLoad={() => setFrameLoaded(true)}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              referrerPolicy="no-referrer"
              className="block h-[70vh] min-h-[28rem] w-full rounded-2xl bg-surface"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-subtle p-4">
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-accent-strong underline underline-offset-4"
            >
              Open the form in a new tab
            </a>
            {slow && !frameLoaded ? (
              <span role="status" className="text-sm text-muted">
                Not showing up? Use the new-tab link, or write to{" "}
                <a className="underline underline-offset-4" href={`mailto:${HELP}`}>
                  {HELP}
                </a>
                .
              </span>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="border-dashed border-strong bg-transparent shadow-none">
          <h2 className="text-lg">E-sign is not connected yet</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            The signing form will appear here once the team connects it. Until then, a mentor will
            tell you how to fill out the waiver. Questions? Write to{" "}
            <a className="font-medium underline underline-offset-4" href={`mailto:${HELP}`}>
              {HELP}
            </a>
            .
          </p>
        </Card>
      )}

      {!done ? (
        <Card>
          <h2 className="text-lg">Already filled it out?</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Tell us and we will mark it as signed by you. A mentor checks it against the real form
            later, so say this only if you really finished it.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => selfReport.mutate()}
              disabled={selfReport.isPending || data.status === "self_reported"}
            >
              {selfReport.isPending ? <Spinner className="size-4" /> : null}I already filled out the
              form
            </Button>
            {data.status === "self_reported" ? (
              <span role="status" className="text-sm text-muted">
                Thanks. We have it marked, and a mentor will check it.
              </span>
            ) : null}
          </div>
          {errorMessage ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

export function WaiversDonePage() {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: signingQueryOptions.queryKey });
    void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
  }, [queryClient]);

  return (
    <Card fire className="pt-7">
      <h1 className="text-3xl">Thanks, that went through</h1>
      <p className="mt-3 max-w-prose text-muted">
        Your form was sent. It can take a minute to show up. Check your status on the dashboard, and
        write to{" "}
        <a className="font-medium underline underline-offset-4" href={`mailto:${HELP}`}>
          {HELP}
        </a>{" "}
        if it still says not signed after a while.
      </p>
      <a
        href="/dashboard"
        className="mt-5 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong"
      >
        Back to your dashboard
      </a>
    </Card>
  );
}
