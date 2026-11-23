import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmailAuthForm } from "../components/email-auth-form";
import { Alert, BrandMark, Button, Card, linkClass, Spinner } from "../components/ui";
import { ApiError, meQueryOptions } from "../lib/api";
import { signInWithGoogle } from "../lib/auth";
import { HELP_EMAIL } from "../lib/contact";

export function LoginPage() {
  const navigate = useNavigate();
  const { error } = useSearch({ from: "/" });
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: me, isLoading } = useQuery(meQueryOptions);

  useEffect(() => {
    if (me) void navigate({ to: "/dashboard", replace: true });
  }, [me, navigate]);

  async function handleSignIn() {
    setFailed(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // A successful social sign-in is a full-page redirect to Google; if we return here,
      // the redirect did not start.
    } catch (cause) {
      setFailed(
        cause instanceof ApiError
          ? cause.message
          : "Google sign-in could not start. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-sm text-muted">
        <Spinner />
        <span>Checking your session…</span>
      </div>
    );
  }

  const problem =
    failed ?? (error ? "Google sign-in did not finish. Try again, or use email." : null);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandMark />
        <span className="hidden text-sm text-muted sm:inline">FRC Team 10989 · Blast Robotics</span>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-start px-4 pt-2 pb-8 sm:px-6 lg:items-center lg:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Hero: a compact strip on phones (the heading only), the full team artwork from lg up. */}
          <section
            aria-label="Blast Robotics"
            className="overflow-hidden rounded-3xl bg-black text-white"
          >
            <div className="p-5 sm:p-8">
              <h1 className="text-2xl font-bold text-balance sm:text-3xl">Join the team.</h1>
              <p className="mt-2 max-w-prose text-base text-white/85">
                Sign in to get started. Students, parents and mentors all begin here.
              </p>
            </div>
            <img
              src="/brand/blast-robotics-black.png"
              alt="Blast Robotics, team 10989"
              width={1600}
              height={800}
              className="hidden h-auto w-full lg:block"
            />
          </section>

          {/* Sign-in region. Everything that signs a person in lives in this card. */}
          <section aria-label="Sign in" className="flex flex-col gap-4">
            <Card fire className="pt-8">
              <h2 className="text-xl">Sign in</h2>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleSignIn}
                  disabled={busy}
                  aria-busy={busy}
                  className="w-full border-2 border-ink"
                >
                  {busy ? <Spinner className="size-4" /> : <GoogleMark />}
                  Continue with Google
                </Button>
                <p className="text-sm text-muted">Use the Google account you use with the team.</p>
              </div>

              {problem ? <Alert className="mt-4">{problem}</Alert> : null}

              <div className="mt-4">
                <EmailAuthForm />
              </div>

              <p className="mt-4 text-sm text-muted">
                Stuck or locked out? Write to{" "}
                <a href={`mailto:${HELP_EMAIL}`} className={linkClass}>
                  {HELP_EMAIL}
                </a>
                .
              </p>
            </Card>

            <details className="group px-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                What happens after I sign in?
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="size-4 shrink-0 group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 8 5 5 5-5" />
                </svg>
              </summary>
              <ol className="mt-1 space-y-3 pb-2 text-sm text-muted">
                <li className="flex gap-3">
                  <Step n={1} />
                  <span>You tell us if you are a student, a parent or a mentor.</span>
                </li>
                <li className="flex gap-3">
                  <Step n={2} />
                  <span>We look for your name, or your child’s, on the team roster.</span>
                </li>
                <li className="flex gap-3">
                  <Step n={3} />
                  <span>
                    Found you? You are in. If we cannot find you, or you are a mentor, a mentor will
                    confirm you.
                  </span>
                </li>
              </ol>
            </details>
          </section>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted sm:px-6">
        Blast Robotics is part of the Keystone STEM Alliance.
      </footer>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
      {n}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.9h5.35c-.23 1.5-1.65 4.4-5.35 4.4a5.9 5.9 0 0 1 0-11.8c1.68 0 2.8.72 3.45 1.34l2.35-2.27C16.05 4.03 14.24 3.2 12 3.2a8.8 8.8 0 1 0 0 17.6c5.08 0 8.45-3.57 8.45-8.6 0-.58-.06-1.02-.1-1.1Z"
      />
    </svg>
  );
}
