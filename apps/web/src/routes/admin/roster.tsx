import type { AdminRosterRow } from "@launchpad/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import {
  ConfirmDialog,
  Dialog,
  EmptyBlock,
  ErrorBlock,
  errorMessage,
  Field,
  inputClass,
  LoadingBlock,
  Pager,
  useDebounced,
} from "../../components/admin-ui";
import { Button, classes, Pill, Spinner } from "../../components/ui";
import {
  ADMIN_KEY,
  createRosterEntry,
  importRoster,
  patchRosterEntry,
  rosterQuery,
  unclaimRosterEntry,
} from "../../lib/admin-api";

const LIMIT = 25;
type State = "all" | "claimed" | "unclaimed";
const STATES: { id: State; label: string }[] = [
  { id: "all", label: "All" },
  { id: "claimed", label: "Claimed" },
  { id: "unclaimed", label: "Unclaimed" },
];

export function AdminRosterPage() {
  const search = useSearch({ strict: false }) as { state?: State };
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>(search.state ?? "all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(q.trim());

  const [editing, setEditing] = useState<AdminRosterRow | "new" | null>(null);
  const [unclaiming, setUnclaiming] = useState<AdminRosterRow | null>(null);
  const [importing, setImporting] = useState(false);

  const { data, isPending, error, refetch, isFetching } = useQuery(
    rosterQuery({ q: debounced || undefined, state, page, limit: LIMIT }),
  );

  const unclaim = useMutation({
    mutationFn: (id: string) => unclaimRosterEntry(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      setUnclaiming(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <Field label={`Search ${data?.season ? `${data.season} roster` : "roster"}`}>
            {(id) => (
              <input
                id={id}
                type="search"
                className={inputClass}
                placeholder="Name"
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
              />
            )}
          </Field>
        </div>
        <Button variant="secondary" onClick={() => setImporting(true)}>
          Import CSV
        </Button>
        <Button onClick={() => setEditing("new")}>Add entry</Button>
      </div>

      <fieldset className="flex gap-1 border-0 p-0">
        <legend className="sr-only">Filter by claim state</legend>
        {STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={state === s.id}
            onClick={() => {
              setState(s.id);
              setPage(1);
            }}
            className={classes(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
              state === s.id
                ? "border-ink bg-ink text-white"
                : "border-strong bg-surface text-muted hover:text-primary",
            )}
          >
            {s.label}
          </button>
        ))}
      </fieldset>

      {isPending ? <LoadingBlock label="Loading roster" /> : null}
      {error && !data ? <ErrorBlock error={error} onRetry={() => void refetch()} /> : null}
      {data && data.items.length === 0 ? (
        <EmptyBlock>
          {state === "unclaimed"
            ? "Every roster entry in this view has been claimed."
            : "No roster entries match."}
        </EmptyBlock>
      ) : null}

      {data && data.items.length > 0 ? (
        <div aria-busy={isFetching}>
          <div className="hidden overflow-hidden rounded-xl border border-subtle bg-surface md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Roster entries</caption>
              <thead className="bg-subtle/40 text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Grade
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Class of
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Claimed by
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {data.items.map((row) => (
                  <tr key={row.id} className="hover:bg-subtle/30">
                    <td className="px-4 py-3 font-medium">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.grade ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{row.graduationYear ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.claimedBy ? (
                        <Pill tone="success">{row.claimedBy.name}</Pill>
                      ) : (
                        <Pill>unclaimed</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions row={row} onEdit={setEditing} onUnclaim={setUnclaiming} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {data.items.map((row) => (
              <li key={row.id} className="rounded-xl border border-subtle bg-surface p-4">
                <p className="font-medium">
                  {row.firstName} {row.lastName}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Grade {row.grade ?? "—"} · class of {row.graduationYear ?? "—"}
                </p>
                <p className="mt-2">
                  {row.claimedBy ? (
                    <Pill tone="success">Claimed by {row.claimedBy.name}</Pill>
                  ) : (
                    <Pill>unclaimed</Pill>
                  )}
                </p>
                <div className="mt-3">
                  <RowActions row={row} onEdit={setEditing} onUnclaim={setUnclaiming} />
                </div>
              </li>
            ))}
          </ul>

          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </div>
      ) : null}

      <EntryDialog entry={editing} onClose={() => setEditing(null)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />

      <ConfirmDialog
        open={unclaiming !== null}
        title="Unclaim this entry?"
        confirmLabel="Unclaim"
        busy={unclaim.isPending}
        error={unclaim.error ? errorMessage(unclaim.error) : null}
        onConfirm={() => unclaiming && unclaim.mutate(unclaiming.id)}
        onCancel={() => {
          setUnclaiming(null);
          unclaim.reset();
        }}
      >
        <p>
          {unclaiming?.claimedBy?.name ?? "The person"} loses the access this claim gave them and
          goes back to pending. They can claim again, and the entry becomes available to the right
          person. This is recorded in the activity log.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function RowActions({
  row,
  onEdit,
  onUnclaim,
}: {
  row: AdminRosterRow;
  onEdit: (row: AdminRosterRow) => void;
  onUnclaim: (row: AdminRosterRow) => void;
}) {
  return (
    <span className="flex justify-end gap-2">
      <Button variant="secondary" size="sm" onClick={() => onEdit(row)}>
        Edit
        <span className="sr-only">
          {" "}
          {row.firstName} {row.lastName}
        </span>
      </Button>
      {row.claimedBy ? (
        <Button variant="secondary" size="sm" onClick={() => onUnclaim(row)}>
          Unclaim
          <span className="sr-only">
            {" "}
            {row.firstName} {row.lastName}
          </span>
        </Button>
      ) : null}
    </span>
  );
}

function EntryDialog({
  entry,
  onClose,
}: {
  entry: AdminRosterRow | "new" | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={entry !== null}
      onClose={onClose}
      title={entry === "new" ? "Add roster entry" : "Edit roster entry"}
    >
      {entry ? (
        <EntryForm key={entry === "new" ? "new" : entry.id} entry={entry} onDone={onClose} />
      ) : null}
    </Dialog>
  );
}

function EntryForm({ entry, onDone }: { entry: AdminRosterRow | "new"; onDone: () => void }) {
  const queryClient = useQueryClient();
  const existing = entry === "new" ? null : entry;
  const [firstName, setFirstName] = useState(existing?.firstName ?? "");
  const [lastName, setLastName] = useState(existing?.lastName ?? "");
  const [grade, setGrade] = useState(existing?.grade ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const g = grade.trim();
      if (existing) {
        return patchRosterEntry(existing.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          grade: g === "" ? null : g,
        });
      }
      return createRosterEntry({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        grade: g === "" ? null : g,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      onDone();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          {(id) => (
            <input
              id={id}
              required
              maxLength={60}
              className={inputClass}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          )}
        </Field>
        <Field label="Last name">
          {(id) => (
            <input
              id={id}
              required
              maxLength={60}
              className={inputClass}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          )}
        </Field>
      </div>
      <Field label="Grade" hint="1 to 12. Leave blank if unknown.">
        {(id) => (
          <input
            id={id}
            inputMode="numeric"
            maxLength={2}
            className={classes(inputClass, "max-w-[8rem]")}
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          />
        )}
      </Field>
      {save.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(save.error)}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner className="size-4" /> : null}
          {existing ? "Save changes" : "Add entry"}
        </Button>
      </div>
    </form>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Import roster from CSV" wide>
      {open ? <ImportForm onDone={onClose} /> : null}
    </Dialog>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () => importRoster(csv),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });

  async function onFile(file: File | undefined) {
    setFileError(null);
    run.reset();
    if (!file) return;
    if (file.size > 200_000) {
      setFileError("That file is too large. Import 200 KB or less at a time.");
      return;
    }
    setCsv(await file.text());
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Only first name, last name and grade are read. Use a <strong>First Name</strong>,{" "}
        <strong>Last Name</strong> and <strong>Grade</strong> header, or the team sheet's{" "}
        <strong>Names</strong> and <strong>Grade</strong> columns. Phone numbers, emails and every
        other column are ignored. Existing people are updated, never duplicated, and claims are not
        touched.
      </p>
      <Field label="CSV file">
        {(id) => (
          <input
            id={id}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-ink/80 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        )}
      </Field>
      <Field label="Or paste CSV text">
        {(id) => (
          <textarea
            id={id}
            rows={6}
            className={classes(inputClass, "h-auto py-2 font-mono text-xs")}
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              run.reset();
            }}
          />
        )}
      </Field>

      {fileError ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {fileError}
        </p>
      ) : null}
      {run.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(run.error)}
        </p>
      ) : null}
      {run.data ? (
        <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          Import finished: {run.data.inserted} added, {run.data.updated} updated, {run.data.skipped}{" "}
          skipped.
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {run.data ? "Done" : "Cancel"}
        </Button>
        <Button onClick={() => run.mutate()} disabled={csv.trim() === "" || run.isPending}>
          {run.isPending ? <Spinner className="size-4" /> : null}
          Import
        </Button>
      </div>
    </div>
  );
}
