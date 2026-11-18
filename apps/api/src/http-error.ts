/**
 * An expected failure with a status and a stable code, thrown from route handlers.
 * The app-level error boundary turns it into the standard JSON envelope; anything that is
 * not an `HttpError` is treated as an unexpected 500 and never leaks its message.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
