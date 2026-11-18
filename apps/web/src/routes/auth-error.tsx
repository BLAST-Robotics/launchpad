import { Link, useSearch } from "@tanstack/react-router";
import { BrandMark, buttonClass, Card, linkClass } from "../components/ui";
import { HELP_EMAIL } from "../lib/contact";

const MESSAGES: Record<string, { title: string; body: string }> = {
  access_denied: {
    title: "Google sign-in was cancelled",
    body: "You closed the Google window or chose not to continue. Nothing was changed. You can try again.",
  },
  state_mismatch: {
    title: "That sign-in took too long",
    body: "The page timed out or was opened in another tab. Go back and start again from this browser tab.",
  },
  account_not_linked: {
    title: "That email already has an account",
    body: "It was made another way. If you first signed up with Google, sign in with Google. If you used an email and password, use those instead.",
  },
  email_not_found: {
    title: "Google did not share your email",
    body: "LaunchPad needs your email to find you on the roster. Go back, try again, and allow it. Or sign up with an email and password instead.",
  },
};

const FALLBACK = {
  title: "Sign-in did not finish",
  body: "Something interrupted it. This is usually temporary, so try again.",
};

export function AuthErrorPage() {
  const { error } = useSearch({ from: "/auth/error" });
  const message = (error ? MESSAGES[error] : undefined) ?? FALLBACK;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-4 sm:px-6">
        <BrandMark />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-start justify-center px-4 pt-2 pb-8 sm:px-6 sm:pt-10">
        <Card fire className="w-full max-w-md pt-8">
          <h1 className="text-2xl">{message.title}</h1>
          <p className="mt-3 text-base text-muted">{message.body}</p>

          <div className="mt-6">
            <Link to="/" className={buttonClass("primary", "lg", "w-full")}>
              Back to sign in
            </Link>
          </div>

          <p className="mt-4 text-sm text-muted">
            Still stuck? Write to{" "}
            <a href={`mailto:${HELP_EMAIL}`} className={linkClass}>
              {HELP_EMAIL}
            </a>
            .
          </p>

          {error ? (
            <details className="mt-4 text-sm text-muted">
              <summary className="min-h-11 cursor-pointer py-2.5 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2">
                Details for the person helping you
              </summary>
              <p className="rounded-lg bg-subtle/50 px-3 py-2 font-mono text-xs break-all">
                {error}
              </p>
            </details>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
