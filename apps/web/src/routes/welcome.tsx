import type { OnboardingResponse, OnboardingRole, RosterMatchDto } from "@launchpad/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useMemo, useRef, useState } from "react";
import { Button, Card, classes, Spinner } from "../components/ui";
import { ApiError, meQueryOptions } from "../lib/api";
import { fetchRosterMatches, submitOnboarding } from "../lib/onboarding";
import { PendingScreen } from "./root";

type Step = "role" | "details" | "match" | "done";

const ROLE_CARDS: ReadonlyArray<{ role: OnboardingRole; title: string; body: string }> = [
  { role: "student", title: "Student", body: "I am on the team this season." },
  { role: "parent", title: "Parent or guardian", body: "My kid is on the team." },
  { role: "mentor", title: "Mentor", body: "I help coach or run the team." },
];

const OUTCOME_COPY: Record<OnboardingResponse["outcome"], { title: string; body: string }> = {
  claimed: {
    title: "You're in. Welcome to the team.",
    body: "Your account is linked to your roster entry and your access is turned on.",
  },
  linked: {
    title: "Linked to your student.",
    body: "You can see your child's team information from your dashboard.",
  },
  pending: {
    title: "A mentor will confirm you.",
    body: "Your details are saved. You will get access once a mentor confirms who you are.",
  },
};

export function WelcomePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me, isPending } = useQuery(meQueryOptions);

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [gradYear, setGradYear] = useState("");
  const [childName, setChildName] = useState("");
  const [childYear, setChildYear] = useState("");
  const [matches, setMatches] = useState<RosterMatchDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<OnboardingResponse["outcome"] | null>(null);
  const requestId = useRef(0);

  const ids = { name: useId(), year: useId(), child: useId(), childYear: useId() };

  const seasonEndYear = useMemo(() => {
    const iso = me?.season?.endsOn;
    const parsed = iso ? Number.parseInt(iso.slice(0, 4), 10) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  }, [me?.season?.endsOn]);
  // Grade 12 graduates at season end; grade 6 seven classes later.
  const years = useMemo(
    () => Array.from({ length: 7 }, (_, index) => seasonEndYear + index),
    [seasonEndYear],
  );

  if (isPending || !me) return <PendingScreen label="Loading" />;

  const fullName = name ?? me.name;
  const needsMatch = role === "student" || role === "parent";
  const dots: Step[] = needsMatch ? ["role", "details", "match"] : ["role", "details"];

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function chooseRole(next: OnboardingRole) {
    setRole(next);
    setMatches([]);
    go("details");
  }

  async function finish(rosterEntryId: string | null) {
    if (!role) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitOnboarding({
        role,
        name: fullName.trim(),
        ...(role === "student" ? { graduationYear: Number.parseInt(gradYear, 10) } : {}),
        rosterEntryId,
      });
      setOutcome(result.outcome);
      setStep("done");
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "ALREADY_ONBOARDED") {
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        await navigate({ to: "/dashboard", replace: true });
        return;
      }
      if (cause instanceof ApiError && cause.code === "ALREADY_CLAIMED") {
        setError("Someone already claimed that roster entry. Ask an admin to fix it.");
        setMatches((current) =>
          current.map((match) =>
            match.id === rosterEntryId ? { ...match, claimed: true } : match,
          ),
        );
      } else {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "That did not save. Check your connection and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !role) return;
    setError(null);

    if (fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (role === "mentor") {
      await finish(null);
      return;
    }

    const typed = role === "student" ? fullName : childName;
    const year = role === "student" ? gradYear : childYear;
    if (role === "student" && !gradYear) {
      setError("Choose your graduation year.");
      return;
    }
    if (role === "parent" && childName.trim().length < 2) {
      setError("Enter your child's full name.");
      return;
    }

    const mine = ++requestId.current;
    setBusy(true);
    try {
      const result = await fetchRosterMatches({
        name: typed,
        graduationYear: year ? Number.parseInt(year, 10) : undefined,
      });
      if (mine !== requestId.current) return;
      setMatches(result.matches);
      setStep("match");
    } catch {
      if (mine !== requestId.current) return;
      setError("Could not look up the roster. Check your connection and try again.");
    } finally {
      if (mine === requestId.current) setBusy(false);
    }
  }

  async function goToDashboard() {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    await navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Welcome</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Let's find you.</h1>

      {step !== "done" ? (
        <ol className="mt-5 flex items-center gap-2" aria-label="Progress">
          {dots.map((dot, index) => (
            <li
              key={dot}
              aria-current={dot === step ? "step" : undefined}
              className={classes(
                "h-2 rounded-full transition-all",
                dot === step
                  ? "w-8 bg-accent"
                  : dots.indexOf(step) > index
                    ? "w-2 bg-ink"
                    : "w-2 bg-strong",
              )}
            >
              <span className="sr-only">{dot}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <Card fire className="mt-6 pt-8">
        {step === "role" ? (
          <div>
            <h2 className="text-xl font-bold tracking-tight">Which describes you?</h2>
            <div className="mt-5 grid gap-3">
              {ROLE_CARDS.map((card) => (
                <button
                  key={card.role}
                  type="button"
                  onClick={() => chooseRole(card.role)}
                  className="rounded-xl border border-strong bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span className="block text-base font-semibold">{card.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{card.body}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === "details" && role ? (
          <form onSubmit={handleDetails} noValidate>
            <h2 className="text-xl font-bold tracking-tight">
              {role === "parent" ? "A little about you and your kid" : "A little about you"}
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor={ids.name} className="mb-1 block text-sm font-medium">
                  Your full name
                </label>
                <input
                  id={ids.name}
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setName(event.target.value)}
                  className={INPUT}
                />
              </div>

              {role === "student" ? (
                <div>
                  <label htmlFor={ids.year} className="mb-1 block text-sm font-medium">
                    Graduation year
                  </label>
                  <select
                    id={ids.year}
                    value={gradYear}
                    onChange={(event) => setGradYear(event.target.value)}
                    className={INPUT}
                  >
                    <option value="">Choose your class</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        Class of {year}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {role === "parent" ? (
                <>
                  <div>
                    <label htmlFor={ids.child} className="mb-1 block text-sm font-medium">
                      Your child's full name
                    </label>
                    <input
                      id={ids.child}
                      type="text"
                      autoComplete="off"
                      value={childName}
                      onChange={(event) => setChildName(event.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label htmlFor={ids.childYear} className="mb-1 block text-sm font-medium">
                      Their graduation year{" "}
                      <span className="font-normal text-muted">(optional)</span>
                    </label>
                    <select
                      id={ids.childYear}
                      value={childYear}
                      onChange={(event) => setChildYear(event.target.value)}
                      className={INPUT}
                    >
                      <option value="">Not sure</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          Class of {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}
            </div>

            <ErrorLine message={error} />
            <Nav
              onBack={() => go("role")}
              busy={busy}
              label={role === "mentor" ? "Finish" : "Find me on the roster"}
              submit
            />
          </form>
        ) : null}

        {step === "match" && role ? (
          <MatchStep
            role={role}
            matches={matches}
            busy={busy}
            error={error}
            onPick={(id) => void finish(id)}
            onNone={() => void finish(null)}
            onEdit={() => go("details")}
          />
        ) : null}

        {step === "done" && outcome ? (
          <div>
            <p className="fire-text w-fit text-3xl font-black tracking-tight">All set</p>
            <h2 className="mt-3 text-xl font-bold tracking-tight">
              {role === "mentor" && outcome === "pending"
                ? "A mentor will confirm your mentor access."
                : OUTCOME_COPY[outcome].title}
            </h2>
            <p className="mt-2 text-sm text-muted">{OUTCOME_COPY[outcome].body}</p>
            <Button
              size="lg"
              className="mt-6 w-full sm:w-auto"
              onClick={() => void goToDashboard()}
            >
              Go to my dashboard
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function MatchStep({
  role,
  matches,
  busy,
  error,
  onPick,
  onNone,
  onEdit,
}: {
  role: OnboardingRole;
  matches: RosterMatchDto[];
  busy: boolean;
  error: string | null;
  onPick: (id: string) => void;
  onNone: () => void;
  onEdit: () => void;
}) {
  const isStudent = role === "student";
  const single = matches.length === 1 ? matches[0] : undefined;

  if (matches.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold tracking-tight">We couldn't find that name</h2>
        <p className="mt-2 text-sm text-muted">
          {isStudent ? "You are" : "Your child is"} not on the roster under that spelling. Check the
          name, or continue and an admin will sort it out.
        </p>
        <ErrorLine message={error} />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" variant="secondary" onClick={onEdit} disabled={busy}>
            Edit the name
          </Button>
          <Button size="lg" onClick={onNone} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : null}
            Continue without a match
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">
        {single
          ? isStudent
            ? `Are you ${single.firstName} ${single.lastName}?`
            : "Is this your kid?"
          : isStudent
            ? "Which one is you?"
            : "Which one is your kid?"}
      </h2>

      <ul className="mt-5 space-y-3">
        {matches.map((match) => {
          const blocked = isStudent && match.claimed;
          return (
            <li
              key={match.id}
              className={classes(
                "rounded-xl border p-4",
                blocked ? "border-subtle bg-subtle/30" : "border-strong bg-surface",
              )}
            >
              <p className="text-base font-semibold">
                {match.firstName} {match.lastName}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {[
                  match.grade ? `Grade ${match.grade}` : null,
                  match.graduationYear ? `Class of ${match.graduationYear}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "On the roster"}
              </p>
              {blocked ? (
                <p className="mt-3 text-sm text-warning">
                  Already claimed. Ask an admin to fix this.
                </p>
              ) : (
                <Button
                  size="lg"
                  className="mt-3 w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => onPick(match.id)}
                >
                  {busy ? <Spinner className="size-4" /> : null}
                  {single ? "Yes, that's right" : isStudent ? "That's me" : "That's my kid"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <ErrorLine message={error} />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" variant="secondary" onClick={onNone} disabled={busy}>
          {single ? "No, not them" : "None of these"}
        </Button>
        <Button size="lg" variant="ghost" onClick={onEdit} disabled={busy}>
          Edit the name
        </Button>
      </div>
    </div>
  );
}

function Nav({
  onBack,
  busy,
  label,
  submit,
}: {
  onBack: () => void;
  busy: boolean;
  label: string;
  submit?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <Button size="lg" variant="ghost" onClick={onBack} disabled={busy}>
        Back
      </Button>
      <Button size="lg" type={submit ? "submit" : "button"} disabled={busy}>
        {busy ? <Spinner className="size-4" /> : null}
        {label}
      </Button>
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}

const INPUT =
  "block h-11 w-full rounded-lg border border-strong bg-surface px-3 text-base text-primary placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1";
