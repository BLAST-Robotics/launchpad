import {
  type DuesStatus,
  describeDues,
  describeWaiver,
  type MeResponse,
  type WaiverStatus,
} from "@launchpad/shared";
import { Link } from "@tanstack/react-router";
import { Card, Pill } from "./ui";

const WAIVER_TONE: Record<WaiverStatus, "success" | "warning" | "neutral"> = {
  signed: "success",
  self_reported: "warning",
  signed_assumed: "neutral",
  missing: "warning",
  not_required: "neutral",
};

const DUES_TONE: Record<DuesStatus, "success" | "warning" | "neutral"> = {
  paid: "success",
  unpaid: "warning",
  unknown: "neutral",
};

const HELP = "admin@team10989.org";

function WaiverCard({ status, who }: { status: WaiverStatus; who?: string | undefined }) {
  const text = describeWaiver(status);
  const needsAction = status === "missing" || status === "self_reported";
  return (
    <Card>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        Waiver{who ? ` · ${who}` : ""}
      </p>
      <div className="mt-3">
        <Pill tone={WAIVER_TONE[status]}>{text.label}</Pill>
      </div>
      <p className="mt-3 text-sm text-muted">{text.detail}</p>
      <Link
        to="/waivers"
        className="mt-4 inline-block text-sm font-medium text-accent-strong underline underline-offset-4"
      >
        {needsAction ? "Fill out the waiver" : "See waiver details"}
      </Link>
    </Card>
  );
}

function DuesCard({ status, who }: { status: DuesStatus; who?: string | undefined }) {
  const text = describeDues(status);
  return (
    <Card>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        Dues{who ? ` · ${who}` : ""}
      </p>
      <div className="mt-3">
        <Pill tone={DUES_TONE[status]}>{text.label}</Pill>
      </div>
      <p className="mt-3 text-sm text-muted">{text.detail}</p>
    </Card>
  );
}

/** Waiver and dues cards: a student's own, or one pair per linked child for a parent. */
export function StatusCards({ me }: { me: MeResponse }) {
  const hasOwn = me.dues !== null || me.waiver !== null;
  const hasChildren = me.guardianOf.length > 0;

  if (!hasOwn && !hasChildren) {
    return (
      <section aria-label="Your status" className="space-y-3">
        <h2 className="text-lg font-bold">Your status</h2>
        <Card className="border-dashed border-strong bg-transparent shadow-none">
          <p className="text-sm text-muted">
            Waiver and dues show up here once you are linked to a roster spot. Stuck? Write to{" "}
            <a className="font-medium underline underline-offset-4" href={`mailto:${HELP}`}>
              {HELP}
            </a>
            .
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section aria-label="Your status" className="space-y-3">
      <h2 className="text-lg font-bold">Your status</h2>
      {hasOwn ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {me.waiver ? <WaiverCard status={me.waiver} /> : null}
          {me.dues ? <DuesCard status={me.dues} /> : null}
        </div>
      ) : null}
      {me.guardianOf.map((child) => (
        <div key={child.id} className="grid gap-4 sm:grid-cols-2">
          <WaiverCard status={child.waiver} who={child.firstName} />
          <DuesCard status={child.dues} who={child.firstName} />
        </div>
      ))}
    </section>
  );
}
