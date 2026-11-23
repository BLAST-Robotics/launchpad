import { useQuery } from "@tanstack/react-query";
import { GroupStatus } from "../components/group-status";
import { StatusCards } from "../components/status-cards";
import { Card, Pill } from "../components/ui";
import { meQueryOptions } from "../lib/api";
import { PendingScreen } from "./root";

const STATUS_TONE = {
  active: "success",
  alumni: "accent",
  archived: "neutral",
} as const;

export function DashboardPage() {
  const { data: me, isPending } = useQuery(meQueryOptions);

  if (isPending || !me) return <PendingScreen label="Loading your profile" />;

  const roles = me.roles.length > 0 ? me.roles : ["no roles"];
  const isPendingApproval =
    me.profileComplete && me.roles.length === 1 && me.roles[0] === "pending";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Signed in</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{me.name}</h1>
        <p className="mt-1 text-sm text-muted">{me.email}</p>
      </div>

      {isPendingApproval ? (
        <div
          role="status"
          className="rounded-2xl border border-warning/25 bg-warning-soft p-5 text-sm text-warning"
        >
          <p className="font-semibold">Pending approval</p>
          <p className="mt-1 max-w-prose">
            {me.requestedRole === "mentor"
              ? "Your mentor request is saved. An admin will confirm who you are and turn your access on."
              : "We couldn't match you to the roster yet. An admin will confirm who you are and turn your access on."}
          </p>
        </div>
      ) : null}

      {me.profileComplete ? <StatusCards me={me} /> : null}
      {me.profileComplete ? <GroupStatus /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card fire className="pt-7">
          <h2 className="text-sm font-semibold">Access</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted uppercase">Roles</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {roles.map((role) => (
                  <Pill key={role} tone={role === "admin" ? "accent" : "neutral"}>
                    {role}
                  </Pill>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted uppercase">Status</dt>
              <dd className="mt-2">
                <Pill tone={STATUS_TONE[me.status]}>{me.status}</Pill>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                Permissions granted
              </dt>
              <dd className="mt-2 text-sm text-muted">
                {me.effectivePermissions.length === 0
                  ? "None yet — claiming a roster entry is what grants access."
                  : `${me.effectivePermissions.length} capabilities`}
              </dd>
            </div>
          </dl>
        </Card>

        <Card fire className="pt-7">
          <h2 className="text-sm font-semibold">Season</h2>
          {me.season ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="fire-text w-fit text-3xl font-black tracking-tight">{me.season.name}</p>
              <p className="text-muted">
                {formatDate(me.season.startsOn)} – {formatDate(me.season.endsOn)}
              </p>
              {me.season.isCurrent ? (
                <Pill tone="success">Current season</Pill>
              ) : (
                <Pill>Past season</Pill>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              No season is seeded yet. Run <code className="text-primary">bun run db:seed</code>.
            </p>
          )}

          <h2 className="mt-8 text-sm font-semibold">Roster entry</h2>
          {me.rosterEntry ? (
            <div className="mt-3 text-sm">
              <p className="font-medium">
                {me.rosterEntry.firstName} {me.rosterEntry.lastName}
              </p>
              <p className="mt-1 text-muted">
                {me.rosterEntry.grade ? `Grade ${me.rosterEntry.grade} · ` : ""}
                <span className="capitalize">{me.rosterEntry.status}</span>
              </p>
            </div>
          ) : me.guardianOf.length > 0 ? null : (
            <p className="mt-3 text-sm text-muted">No roster entry claimed yet.</p>
          )}

          {me.guardianOf.length > 0 ? (
            <div className="mt-6">
              <h2 className="text-sm font-semibold">
                {me.guardianOf.length === 1 ? "Your student" : "Your students"}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {me.guardianOf.map((child) => (
                  <li key={child.id}>
                    <p className="font-medium">
                      {child.firstName} {child.lastName}
                    </p>
                    {child.grade ? <p className="text-muted">Grade {child.grade}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="border-dashed border-strong bg-transparent shadow-none">
        <h2 className="text-sm font-semibold">What's next</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Phase 0 proves identity. Phase 1 adds the roster and the claim screen — that is where a
          pending account becomes a student or parent and gains real access.
        </p>
        <p className="mt-4 text-xs text-muted">
          Session ID prefix: <code className="text-primary">{me.id.slice(0, 8)}</code>
        </p>
      </Card>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
