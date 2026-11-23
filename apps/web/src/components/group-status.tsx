import {
  describeGroup,
  type GroupKey,
  type GroupState,
  groupsStatusResponseSchema,
} from "@launchpad/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { Card, Pill } from "./ui";

const TONE: Record<GroupState, "success" | "warning" | "neutral"> = {
  member: "success",
  not_member: "warning",
  not_connected: "neutral",
  not_configured: "neutral",
  unknown: "neutral",
};

const TITLE: Record<GroupKey, string> = {
  students: "Team Google Group · students",
  parents: "Team Google Group · parents",
};

/**
 * Whether the signed-in person is in the Google group they should be in. Renders nothing
 * for people the check does not apply to (mentors, pending), and fails quietly: the rest
 * of the dashboard never waits on Google.
 */
export function GroupStatus() {
  const { data } = useQuery({
    queryKey: ["groups-status"],
    queryFn: () => apiFetch("/api/groups/status", groupsStatusResponseSchema),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!data || data.groups.length === 0) return null;

  return (
    <section aria-label="Team Google Group" className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {data.groups.map(({ key, state }) => {
          const text = describeGroup(key, state);
          return (
            <Card key={key}>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                {TITLE[key]}
              </p>
              <div className="mt-3">
                <Pill tone={TONE[state]}>{text.label}</Pill>
              </div>
              <p className="mt-3 text-sm text-muted">{text.detail}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
