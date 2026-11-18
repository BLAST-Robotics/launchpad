import type { SubmissionStatus } from "@launchpad/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CoreValueUpload } from "../components/core-value-upload";
import { Card, linkClass, Pill, Spinner } from "../components/ui";
import {
  CORE_VALUE_TITLES,
  CORE_VALUES,
  CORE_VALUES_FALLBACK_FORM,
  CORE_VALUES_TAGLINE,
} from "../content/core-values";
import { HELP_EMAIL } from "../lib/contact";
import { mySubmissionQuery } from "../lib/core-values";

const STATUS_COPY: Record<
  SubmissionStatus,
  { label: string; tone: "accent" | "success" | "warning"; detail: string }
> = {
  uploaded: {
    label: "Video received",
    tone: "accent",
    detail: "A mentor will take a look.",
  },
  approved: { label: "Approved", tone: "success", detail: "You're all set. Nice work." },
  needs_redo: {
    label: "Please record again",
    tone: "warning",
    detail: "A mentor asked for another take. Pick a value below and upload a new video.",
  },
};

export function CoreValuesPage() {
  const { data, isPending, error } = useQuery(mySubmissionQuery);
  const [picked, setPicked] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const submission = data?.submission ?? null;
  const showPicker =
    Boolean(data?.eligible && data.configured) &&
    (!submission || submission.status === "needs_redo" || replacing);
  const chosen = CORE_VALUES.find((value) => value.key === picked) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          {CORE_VALUES_TAGLINE}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Our core values</h1>
        <p className="mt-3 max-w-prose text-muted">
          Pick the one that means the most to you, then record a short video of yourself talking
          about it.
        </p>
      </div>

      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Loading…
        </p>
      ) : null}

      {error ? (
        <Card>
          <h2 className="text-lg">We could not load this page</h2>
          <p className="mt-2 text-sm text-muted">
            Refresh and try again. Still stuck? Write to{" "}
            <a className={linkClass} href={`mailto:${HELP_EMAIL}`}>
              {HELP_EMAIL}
            </a>
            .
          </p>
        </Card>
      ) : null}

      {data && !data.eligible ? (
        <Card className="border-dashed border-strong bg-transparent shadow-none">
          <h2 className="text-lg">Claim your roster spot first</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            You can send in your video once you're matched to the team roster. If you skipped that
            step or it did not work, write to{" "}
            <a className={linkClass} href={`mailto:${HELP_EMAIL}`}>
              {HELP_EMAIL}
            </a>
            .
          </p>
        </Card>
      ) : null}

      {submission ? (
        <Card fire>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg">Your video: {CORE_VALUE_TITLES[submission.coreValue]}</h2>
            <Pill tone={STATUS_COPY[submission.status].tone}>
              {STATUS_COPY[submission.status].label}
            </Pill>
          </div>
          <p className="mt-2 text-sm text-muted">{STATUS_COPY[submission.status].detail}</p>
          {submission.status !== "needs_redo" && data?.configured && !replacing ? (
            <button
              type="button"
              className={`${linkClass} mt-3`}
              onClick={() => setReplacing(true)}
            >
              Upload a different video
            </button>
          ) : null}
        </Card>
      ) : null}

      {data?.eligible && !data.configured ? (
        <Card>
          <h2 className="text-lg">Send your video with the backup form</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Uploading here is not switched on yet. Use the team's form for now.
          </p>
          <a
            className={`${linkClass} mt-3 inline-block`}
            href={CORE_VALUES_FALLBACK_FORM}
            target="_blank"
            rel="noreferrer"
          >
            Open the backup form
          </a>
        </Card>
      ) : null}

      <fieldset className="space-y-3" disabled={!showPicker}>
        <legend className="sr-only">Pick a core value</legend>
        <ol className="grid gap-3 sm:grid-cols-2">
          {CORE_VALUES.map((value, index) => {
            const selected = picked === value.key;
            return (
              <li key={value.key}>
                <label
                  className={`flex h-full min-h-11 cursor-pointer gap-3 rounded-2xl border bg-surface p-4 shadow-card focus-within:outline-2 focus-within:outline-offset-2 ${
                    selected ? "border-ink ring-2 ring-ink" : "border-subtle"
                  }`}
                >
                  <input
                    type="radio"
                    name="core-value"
                    className="sr-only"
                    checked={selected}
                    onChange={() => setPicked(value.key)}
                  />
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white"
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-display text-base font-bold">{value.title}</span>
                    <span className="mt-1 block text-sm text-muted">{value.meaning}</span>
                    {selected ? (
                      <span className="mt-2 block text-sm font-medium text-primary">Your pick</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
      </fieldset>

      {showPicker ? (
        <Card>
          <h2 className="text-lg">Pick one and record your video</h2>
          {chosen ? (
            <div className="mt-4">
              <CoreValueUpload key={chosen.key} value={chosen} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Choose a value above to continue.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
