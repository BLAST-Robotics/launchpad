import type { SubmissionStatus } from "@launchpad/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyBlock,
  ErrorBlock,
  errorMessage,
  Field,
  formatWhen,
  LoadingBlock,
  Pager,
  selectClass,
} from "../../components/admin-ui";
import { Button, linkClass, Pill } from "../../components/ui";
import { CORE_VALUE_TITLES } from "../../content/core-values";
import { ADMIN_KEY, coreValuesQuery, reviewCoreValue } from "../../lib/admin-api";

const LIMIT = 25;

const STATUS: Record<SubmissionStatus, { label: string; tone: "accent" | "success" | "warning" }> =
  {
    uploaded: { label: "Waiting for review", tone: "accent" },
    approved: { label: "Approved", tone: "success" },
    needs_redo: { label: "Needs another take", tone: "warning" },
  };

const size = (bytes: number | null) =>
  bytes === null ? "size unknown" : `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
const length = (ms: number | null) =>
  ms === null
    ? "length not read yet"
    : `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;

export function AdminCoreValuesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SubmissionStatus | "">("");
  const [page, setPage] = useState(1);
  const [failure, setFailure] = useState<string | null>(null);
  const { data, isPending, error, refetch, isFetching } = useQuery(
    coreValuesQuery({ status: status || undefined, page, limit: LIMIT }),
  );

  const review = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "needs_redo" }) =>
      reviewCoreValue(input.id, { status: input.status }),
    onMutate: () => setFailure(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
    onError: (e) => setFailure(errorMessage(e)),
  });

  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <Field label="Show">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as SubmissionStatus | "");
                setPage(1);
              }}
            >
              <option value="">All videos</option>
              <option value="uploaded">Waiting for review</option>
              <option value="approved">Approved</option>
              <option value="needs_redo">Needs another take</option>
            </select>
          )}
        </Field>
      </div>

      {failure ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {failure}
        </p>
      ) : null}

      {isPending ? <LoadingBlock label="Loading videos" /> : null}
      {error && !data ? <ErrorBlock error={error} onRetry={() => void refetch()} /> : null}
      {data && data.items.length === 0 ? <EmptyBlock>No core values videos yet.</EmptyBlock> : null}

      {data && data.items.length > 0 ? (
        <div aria-busy={isFetching}>
          <ul className="divide-y divide-subtle overflow-hidden rounded-xl border border-subtle bg-surface">
            {data.items.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.studentName}</p>
                    <Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {CORE_VALUE_TITLES[row.coreValue]} · {length(row.durationMs)} ·{" "}
                    {size(row.sizeBytes)} · sent{" "}
                    <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    className={linkClass}
                    href={`https://drive.google.com/file/d/${encodeURIComponent(row.driveFileId)}/view`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Drive
                  </a>
                  <Button
                    size="sm"
                    disabled={review.isPending || row.status === "approved"}
                    onClick={() => review.mutate({ id: row.id, status: "approved" })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={review.isPending || row.status === "needs_redo"}
                    onClick={() => review.mutate({ id: row.id, status: "needs_redo" })}
                  >
                    Needs another take
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </div>
      ) : null}
    </div>
  );
}
