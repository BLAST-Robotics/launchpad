import {
  type AdminMemberDetail,
  type AdminMemberRow,
  MEMBER_STATUSES,
  type MemberStatus,
  ROLES,
  type Role,
} from "@launchpad/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  ConfirmDialog,
  Dialog,
  EmptyBlock,
  ErrorBlock,
  errorMessage,
  Field,
  formatWhen,
  inputClass,
  LoadingBlock,
  Pager,
  selectClass,
  useDebounced,
} from "../../components/admin-ui";
import { Button, Pill, Spinner } from "../../components/ui";
import {
  ADMIN_KEY,
  memberDetailQuery,
  membersQuery,
  patchMember,
  revokeSessions,
} from "../../lib/admin-api";

const LIMIT = 25;

function RolePills({ roles }: { roles: readonly Role[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <Pill
          key={role}
          tone={role === "admin" ? "accent" : role === "pending" ? "warning" : "neutral"}
        >
          {role}
        </Pill>
      ))}
    </span>
  );
}

function rosterLabel(row: AdminMemberRow): string {
  if (row.rosterEntry) {
    const grade = row.rosterEntry.grade ? `, grade ${row.rosterEntry.grade}` : "";
    return `${row.rosterEntry.firstName} ${row.rosterEntry.lastName}${grade}`;
  }
  if (row.guardianOfCount > 0) {
    return `Parent of ${row.guardianOfCount} ${row.guardianOfCount === 1 ? "student" : "students"}`;
  }
  return "—";
}

export function AdminMembersPage() {
  const search = useSearch({ strict: false }) as {
    role?: Role;
    status?: MemberStatus;
    q?: string;
  };
  const [q, setQ] = useState(search.q ?? "");
  const [role, setRole] = useState<Role | "">(search.role ?? "");
  const [status, setStatus] = useState<MemberStatus | "">(search.status ?? "");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const debounced = useDebounced(q.trim());

  const { data, isPending, error, refetch, isFetching } = useQuery(
    membersQuery({
      q: debounced || undefined,
      role: role || undefined,
      status: status || undefined,
      page,
      limit: LIMIT,
    }),
  );

  return (
    <div className="space-y-5">
      <form
        aria-label="Filter members"
        className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <Field label="Search">
          {(id) => (
            <input
              id={id}
              type="search"
              className={inputClass}
              placeholder="Name or email"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
        <Field label="Role">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={role}
              onChange={(event) => {
                setRole(event.target.value as Role | "");
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as MemberStatus | "");
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              {MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </Field>
      </form>

      {isPending ? <LoadingBlock label="Loading members" /> : null}
      {error && !data ? <ErrorBlock error={error} onRetry={() => void refetch()} /> : null}
      {data && data.items.length === 0 ? (
        <EmptyBlock>No members match these filters.</EmptyBlock>
      ) : null}

      {data && data.items.length > 0 ? (
        <div aria-busy={isFetching}>
          {/* Table from md up */}
          <div className="hidden overflow-hidden rounded-xl border border-subtle bg-surface md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Members</caption>
              <thead className="bg-subtle/40 text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Member
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Roles
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Linked to
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Last sign-in
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {data.items.map((row) => (
                  <tr key={row.id} className="hover:bg-subtle/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <RolePills roles={row.roles} />
                      {row.status !== "active" ? (
                        <Pill className="mt-1.5">{row.status}</Pill>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{rosterLabel(row)}</td>
                    <td className="px-4 py-3 text-muted">{formatWhen(row.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setOpenId(row.id)}>
                        Manage<span className="sr-only"> {row.name}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stacked cards below md */}
          <ul className="space-y-3 md:hidden">
            {data.items.map((row) => (
              <li key={row.id} className="rounded-xl border border-subtle bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted">{row.email}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setOpenId(row.id)}>
                    Manage<span className="sr-only"> {row.name}</span>
                  </Button>
                </div>
                <div className="mt-3">
                  <RolePills roles={row.roles} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {rosterLabel(row)} · last sign-in {formatWhen(row.lastLoginAt)}
                </p>
              </li>
            ))}
          </ul>

          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </div>
      ) : null}

      <MemberDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function MemberDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Dialog open={id !== null} onClose={onClose} title="Manage member" wide>
      {id ? <MemberEditor id={id} onDone={onClose} /> : null}
    </Dialog>
  );
}

function MemberEditor({ id, onDone }: { id: string; onDone: () => void }) {
  const { data, isPending, error, refetch } = useQuery(memberDetailQuery(id));
  if (isPending) return <LoadingBlock label="Loading member" />;
  if (error || !data) return <ErrorBlock error={error} onRetry={() => void refetch()} />;
  return <MemberForm key={data.id} member={data} onDone={onDone} />;
}

function MemberForm({ member, onDone }: { member: AdminMemberDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<Role[]>(member.roles);
  const [status, setStatus] = useState<MemberStatus>(member.status);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const done = () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY });

  const save = useMutation({
    mutationFn: () => patchMember(member.id, { roles, status }),
    onSuccess: async (updated) => {
      setRoles(updated.roles);
      setStatus(updated.status);
      await done();
      setNotice("Saved.");
    },
  });
  const approve = useMutation({
    mutationFn: () => patchMember(member.id, { approveMentor: true }),
    onSuccess: async (updated) => {
      setRoles(updated.roles);
      setStatus(updated.status);
      await done();
      setNotice("Approved as mentor.");
    },
  });
  const revoke = useMutation({
    mutationFn: () => revokeSessions(member.id),
    onSuccess: async (result) => {
      await done();
      setConfirmRevoke(false);
      setNotice(
        `${result.revoked} ${result.revoked === 1 ? "session" : "sessions"} ended. A browser can stay signed in for up to 5 minutes from its cache.`,
      );
    },
  });

  const changed =
    status !== member.status ||
    roles.length !== member.roles.length ||
    roles.some((r) => !member.roles.includes(r));
  const canApprove =
    member.requestedRole === "mentor" && member.roles.length === 1 && member.roles[0] === "pending";
  const toggle = (role: Role) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-semibold">{member.name}</p>
        <p className="text-sm text-muted">{member.email}</p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-2">
          <div className="flex gap-1">
            <dt>Joined</dt>
            <dd className="text-primary">{formatWhen(member.createdAt)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Last sign-in</dt>
            <dd className="text-primary">{formatWhen(member.lastLoginAt)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Said they are</dt>
            <dd className="text-primary">{member.requestedRole ?? "not answered yet"}</dd>
          </div>
          {member.graduationYear ? (
            <div className="flex gap-1">
              <dt>Graduates</dt>
              <dd className="text-primary">{member.graduationYear}</dd>
            </div>
          ) : null}
        </dl>
        {member.rosterEntry ? (
          <p className="mt-3 text-sm">
            Claimed roster entry:{" "}
            <strong className="font-semibold">
              {member.rosterEntry.firstName} {member.rosterEntry.lastName}
            </strong>
            {member.rosterEntry.grade ? `, grade ${member.rosterEntry.grade}` : ""}
          </p>
        ) : null}
        {member.guardianOf.length > 0 ? (
          <div className="mt-3 text-sm">
            <p>Parent of:</p>
            <ul className="mt-1 list-inside list-disc text-muted">
              {member.guardianOf.map((child) => (
                <li key={child.id}>
                  {child.firstName} {child.lastName}
                  {child.grade ? `, grade ${child.grade}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {canApprove ? (
        <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm text-warning">
          <p className="font-semibold">Asked to be a mentor</p>
          <p className="mt-1">Confirm you know this person, then approve.</p>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => approve.mutate()}
            disabled={approve.isPending}
          >
            {approve.isPending ? <Spinner className="size-3.5" /> : null}
            Approve as mentor
          </Button>
          {approve.error ? (
            <p role="alert" className="mt-2">
              {errorMessage(approve.error)}
            </p>
          ) : null}
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);
          save.mutate();
        }}
      >
        <fieldset>
          <legend className="text-xs font-medium tracking-wide text-muted uppercase">Roles</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={roles.includes(role)}
                  onChange={() => toggle(role)}
                />
                {role}
              </label>
            ))}
          </div>
          {member.isSelf ? (
            <p className="mt-2 text-xs text-muted">
              This is you. You cannot remove your own admin role or deactivate yourself.
            </p>
          ) : null}
        </fieldset>

        <Field
          label="Status"
          hint="Alumni and archived accounts keep their data but lose role access."
        >
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as MemberStatus)}
            >
              {MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </Field>

        {save.error ? (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {errorMessage(save.error)}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-4">
          <Button variant="secondary" size="sm" onClick={() => setConfirmRevoke(true)}>
            Sign out everywhere
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onDone}>
              Close
            </Button>
            <Button type="submit" disabled={!changed || save.isPending}>
              {save.isPending ? <Spinner className="size-4" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmRevoke}
        title="Sign this person out everywhere?"
        confirmLabel="Sign out everywhere"
        busy={revoke.isPending}
        error={revoke.error ? errorMessage(revoke.error) : null}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setConfirmRevoke(false)}
      >
        <p>
          Every browser and device signed in as {member.name} is ended. They can sign back in with
          their Google account or password. Nothing else about their account changes.
        </p>
      </ConfirmDialog>
    </div>
  );
}
