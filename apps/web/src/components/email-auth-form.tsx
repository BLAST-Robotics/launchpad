import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { type AuthField, signInWithEmail, signUpWithEmail } from "../lib/auth";
import { Alert, Button, classes, FieldError, linkClass, Spinner } from "./ui";

type Mode = "signin" | "signup";
type FieldErrors = Partial<Record<AuthField, string>>;

const MIN_PASSWORD = 8;
// Deliberately loose: it only catches typos. The server decides what is a real address.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email + password sign-in / sign-up (D-021). No email is sent and nothing is verified:
 * the roster claim is the access gate, not the address.
 *
 * The form starts collapsed behind one plain row so Google stays the single obvious path;
 * it is a first-class path for students without a Google account, so the row says so.
 */
export function EmailAuthForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const regionId = useId();
  const ids = { name: useId(), email: useId(), password: useId() };
  const inputs: Record<AuthField, React.RefObject<HTMLInputElement | null>> = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };
  const pendingFocus = useRef<AuthField | null>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Move focus after the render that makes the target visible / marks it invalid.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after any state that can reveal or invalidate a field
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    inputs[target].current?.focus();
  }, [open, mode, errors, formError]);

  function toggleOpen() {
    if (!open) pendingFocus.current = mode === "signup" ? "name" : "email";
    setOpen((value) => !value);
  }

  function switchMode() {
    const next: Mode = mode === "signin" ? "signup" : "signin";
    setMode(next);
    setErrors({});
    setFormError(null);
    pendingFocus.current = next === "signup" ? "name" : "email";
  }

  function clearError(field: AuthField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
    setFormError(null);
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (mode === "signup" && name.trim().length < 2) found.name = "Enter your full name.";

    const trimmed = email.trim();
    if (!trimmed) found.email = "Enter your email address.";
    else if (!EMAIL_SHAPE.test(trimmed)) {
      found.email = "That email address does not look right. Check for a missing @ or dot.";
    }

    if (!password) {
      found.password =
        mode === "signin"
          ? "Enter your password."
          : `Choose a password with at least ${MIN_PASSWORD} characters.`;
    } else if (mode === "signup" && password.length < MIN_PASSWORD) {
      found.password = `Use at least ${MIN_PASSWORD} characters for your password.`;
    }
    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFormError(null);

    const found = validate();
    const first = (["name", "email", "password"] as const).find((field) => found[field]);
    if (first) {
      setErrors(found);
      pendingFocus.current = first;
      return;
    }
    setErrors({});

    setBusy(true);
    const result =
      mode === "signup"
        ? await signUpWithEmail({ name: name.trim(), email: email.trim(), password })
        : await signInWithEmail({ email: email.trim(), password });

    if (!result.ok) {
      // Keep everything the person typed; only say what to fix.
      if (result.field) {
        setErrors({ [result.field]: result.message });
        pendingFocus.current = result.field;
      } else {
        setFormError(result.message);
      }
      setBusy(false);
      return;
    }

    // Fresh session: drop anything cached for a previous (or no) user, then let the router
    // gate decide between /welcome and /dashboard.
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    setPassword("");
    await navigate({ to: "/dashboard" });
  }

  const describedBy = (field: AuthField, hintId?: string) =>
    [errors[field] ? `${ids[field]}-error` : null, hintId ?? null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="border-t border-subtle pt-2">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={regionId}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-ink hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        No Google account? Use email.
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={classes("size-4 shrink-0", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      <div id={regionId} hidden={!open} className="pt-3">
        <h2 className="text-base">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>

        <form onSubmit={handleSubmit} noValidate aria-busy={busy} className="mt-4 space-y-4">
          {mode === "signup" ? (
            <Field id={ids.name} label="Full name" error={errors.name}>
              <input
                ref={inputs.name}
                id={ids.name}
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy("name")}
                onChange={(event) => {
                  setName(event.target.value);
                  clearError("name");
                }}
                className={INPUT}
              />
            </Field>
          ) : null}

          <Field id={ids.email} label="Email" error={errors.email}>
            <input
              ref={inputs.email}
              id={ids.email}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy("email")}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
              className={INPUT}
            />
          </Field>

          <Field
            id={ids.password}
            label="Password"
            error={errors.password}
            hint={mode === "signup" ? `At least ${MIN_PASSWORD} characters.` : undefined}
          >
            <div className="relative">
              <input
                ref={inputs.password}
                id={ids.password}
                name="password"
                type={show ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                value={password}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={describedBy(
                  "password",
                  mode === "signup" ? `${ids.password}-hint` : undefined,
                )}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError("password");
                }}
                className={classes(INPUT, "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShow((value) => !value)}
                aria-label="Show password"
                aria-pressed={show}
                aria-controls={ids.password}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <EyeIcon off={show} />
              </button>
            </div>
          </Field>

          {formError ? <Alert>{formError}</Alert> : null}

          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy ? <Spinner className="size-4" /> : null}
            {mode === "signin" ? "Sign in with email" : "Create my account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className={classes(
            linkClass,
            "mt-1 inline-flex min-h-11 w-full items-center justify-center text-sm",
          )}
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

const INPUT =
  "block h-11 w-full rounded-lg border border-muted bg-surface px-3 text-base text-primary placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 aria-[invalid=true]:border-danger";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" />
      <circle cx="10" cy="10" r="2.5" />
      {off ? <path d="M3 17 17 3" /> : null}
    </svg>
  );
}
