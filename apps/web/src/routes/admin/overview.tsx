import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ErrorBlock, LoadingBlock } from "../../components/admin-ui";
import { Card, Pill } from "../../components/ui";
import { overviewQuery } from "../../lib/admin-api";

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <Card fire className="pt-7">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </Card>
  );
}

export function AdminOverviewPage() {
  const { data, isPending, error, refetch } = useQuery(overviewQuery);

  if (isPending) return <LoadingBlock label="Loading overview" />;
  if (error || !data) return <ErrorBlock error={error} onRetry={() => void refetch()} />;

  const rosterPct =
    data.roster.total > 0 ? Math.round((data.roster.claimed / data.roster.total) * 100) : 0;
  const pendingOnly = data.pendingMembers - data.pendingMentors;
  const attention: { key: "mentors" | "pending" | "unclaimed"; text: string }[] = [];
  if (data.pendingMentors > 0) {
    attention.push({
      key: "mentors",
      text: `${data.pendingMentors} mentor ${data.pendingMentors === 1 ? "request" : "requests"} waiting for approval`,
    });
  }
  if (pendingOnly > 0) {
    attention.push({
      key: "pending",
      text: `${pendingOnly} ${pendingOnly === 1 ? "person" : "people"} finished sign-up but could not be matched to the roster`,
    });
  }
  if (data.roster.unclaimed > 0) {
    attention.push({
      key: "unclaimed",
      text: `${data.roster.unclaimed} roster ${data.roster.unclaimed === 1 ? "entry is" : "entries are"} not claimed yet`,
    });
  }
  const linkClass =
    "flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-subtle/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px]";

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={data.totalMembers} note="Accounts that have signed up" />
        <Stat
          label="Awaiting approval"
          value={data.pendingMembers}
          note={`${data.pendingMentors} asked to be mentors`}
        />
        <Stat
          label={`Roster ${data.roster.season ?? ""}`.trim()}
          value={`${data.roster.claimed}/${data.roster.total}`}
          note={`${rosterPct}% claimed`}
        />
        <Stat label="Activity, 7 days" value={data.recentAudit} note="Changes recorded" />
      </div>

      <section aria-labelledby="attention">
        <h2 id="attention" className="text-sm font-semibold">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className="mt-3 rounded-xl bg-success-soft p-4 text-sm text-success">
            Nothing is waiting on you.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-subtle overflow-hidden rounded-xl border border-subtle bg-surface">
            {attention.map((item) => (
              <li key={item.key}>
                {item.key === "unclaimed" ? (
                  <Link to="/admin/roster" search={{ state: "unclaimed" }} className={linkClass}>
                    <span>{item.text}</span>
                    <span aria-hidden="true" className="text-accent">
                      →
                    </span>
                  </Link>
                ) : (
                  <Link to="/admin/members" search={{ role: "pending" }} className={linkClass}>
                    <span>{item.text}</span>
                    <span aria-hidden="true" className="text-accent">
                      →
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Members by role</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {Object.entries(data.membersByRole).map(([role, n]) => (
              <li key={role}>
                <Pill tone={role === "admin" ? "accent" : "neutral"}>
                  {role} · {n}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Members by status</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {Object.entries(data.membersByStatus).map(([status, n]) => (
              <li key={status}>
                <Pill tone={status === "active" ? "success" : "neutral"}>
                  {status} · {n}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
