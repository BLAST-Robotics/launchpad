import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyBlock,
  ErrorBlock,
  Field,
  formatWhen,
  LoadingBlock,
  Pager,
  selectClass,
} from "../../components/admin-ui";
import { Pill } from "../../components/ui";
import { auditQuery } from "../../lib/admin-api";

const LIMIT = 25;

const LABELS: Record<string, string> = {
  "member.onboarded": "Finished sign-up",
  "member.claimed": "Claimed a roster entry",
  "member.guardian_linked": "Linked to a student",
  "member.updated": "Changed roles or status",
  "member.mentor_approved": "Mentor approved",
  "member.sessions_revoked": "Signed out everywhere",
  "member.admin_granted": "Admin granted",
  "roster.created": "Roster entry added",
  "roster.updated": "Roster entry edited",
  "roster.unclaimed": "Roster entry unclaimed",
  "roster.imported": "Roster imported",
  "core_value.submitted": "Core values video sent",
  "core_value.reviewed": "Core values video reviewed",
};

const label = (action: string) => LABELS[action] ?? action;

export function AdminActivityPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch, isFetching } = useQuery(
    auditQuery({ action: action || undefined, page, limit: LIMIT }),
  );

  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <Field label="Show">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Everything</option>
              {(data?.actions ?? []).map((a) => (
                <option key={a} value={a}>
                  {label(a)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {isPending ? <LoadingBlock label="Loading activity" /> : null}
      {error && !data ? <ErrorBlock error={error} onRetry={() => void refetch()} /> : null}
      {data && data.items.length === 0 ? <EmptyBlock>No activity recorded yet.</EmptyBlock> : null}

      {data && data.items.length > 0 ? (
        <div aria-busy={isFetching}>
          <ol className="divide-y divide-subtle overflow-hidden rounded-xl border border-subtle bg-surface">
            {data.items.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium">{label(row.action)}</p>
                  <time dateTime={row.createdAt} className="text-xs text-muted">
                    {formatWhen(row.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  by {row.actorName ?? "the system"}
                  {row.entityId
                    ? ` · ${row.entity.replace("_", " ")} ${row.entityId.slice(0, 8)}`
                    : ""}
                </p>
                {row.changes.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {row.changes.map((change) => (
                      <li key={change.field}>
                        <Pill>
                          {change.field}: {change.from ?? "—"} → {change.to ?? "—"}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </div>
      ) : null}
    </div>
  );
}
