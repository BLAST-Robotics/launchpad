import { createAuthClient } from "better-auth/react";

/**
 * Same-origin client: in dev Vite proxies /api to Elysia on 3000, in production the
 * SPA and API share the deployment origin.
 */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
});

export async function signInWithGoogle(path = "/dashboard"): Promise<void> {
  // Absolute, on the page's own origin. A relative path is resolved against the API's
  // BETTER_AUTH_URL (port 3000 in dev), which serves no SPA routes and answers 404.
  // Without `errorCallbackURL`, Better Auth sends Google errors (account_not_linked,
  // state_mismatch, ...) to its own /api/auth/error page, so the SPA's /auth/error route
  // would never be reached.
  const origin = window.location.origin;
  await authClient.signIn.social({
    provider: "google",
    callbackURL: new URL(path, origin).toString(),
    errorCallbackURL: new URL("/auth/error", origin).toString(),
  });
}

interface AuthClientError {
  status?: number;
  code?: string;
  message?: string;
}

export type AuthField = "name" | "email" | "password";

export interface AuthErrorDescription {
  /** The field the message is about, so the form can focus it. Absent = form-level. */
  field?: AuthField;
  message: string;
}

/**
 * Better Auth reports failures as `{ error }` instead of throwing. This turns them into one
 * sentence a person can act on, plus the field it concerns. Never echoes the server message
 * verbatim, and never says whether the email or the password was the wrong half of a login.
 */
export function describeAuthError(error: AuthClientError | null | undefined): AuthErrorDescription {
  const code = (error?.code ?? "").toUpperCase();
  if (error?.status === 429) {
    return { message: "Too many tries. Wait a minute, then try again." };
  }
  if (code.includes("ALREADY_EXISTS")) {
    return {
      field: "email",
      message: "That email already has an account. Choose “Have an account? Sign in” below.",
    };
  }
  if (code === "INVALID_EMAIL_OR_PASSWORD" || error?.status === 401) {
    return {
      message: "That email and password do not match. Check them, or create an account.",
    };
  }
  if (code === "INVALID_EMAIL") {
    return { field: "email", message: "That email address does not look right." };
  }
  if (code.includes("PASSWORD_TOO_SHORT")) {
    return { field: "password", message: "Use a password with at least 8 characters." };
  }
  if (code.includes("PASSWORD_TOO_LONG")) {
    return { field: "password", message: "That password is too long. Use a shorter one." };
  }
  if (code === "ACCOUNT_NOT_LINKED") {
    return {
      message:
        "This email already has an account made another way. Sign in the same way you did before, or write to admin@team10989.org.",
    };
  }
  return { message: "That did not work. Check your connection and try again." };
}

export type EmailAuthResult =
  | { ok: true }
  | { ok: false; message: string; field?: AuthField | undefined };

function failure(error: AuthClientError | null | undefined): EmailAuthResult {
  const { field, message } = describeAuthError(error);
  return { ok: false, message, field };
}

export async function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<EmailAuthResult> {
  try {
    const { error } = await authClient.signUp.email(input);
    return error ? failure(error) : { ok: true };
  } catch {
    return failure(null);
  }
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<EmailAuthResult> {
  try {
    const { error } = await authClient.signIn.email(input);
    return error ? failure(error) : { ok: true };
  } catch {
    return failure(null);
  }
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
}
