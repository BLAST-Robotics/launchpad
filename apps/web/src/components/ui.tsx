import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:opacity-60",
  secondary:
    "bg-surface text-primary border border-ink/80 hover:bg-ink hover:text-white disabled:opacity-60",
  ghost: "bg-transparent text-muted hover:text-primary hover:bg-subtle/60",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Button look as a class string, so a router `<Link>` can wear it without nesting a button. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return classes(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/** Inline text link / text button: underlined, ink, readable at 16px, 44px tap height. */
export const linkClass =
  "font-medium text-ink underline decoration-2 underline-offset-4 hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2";

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={classes("size-5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v4.5M10 13.5h.01" />
    </svg>
  );
}

/**
 * Form- or page-level problem: icon + danger wash + full 1px border, so it never relies on
 * red text alone. One `role="alert"` region per form (field errors are linked, not alerts).
 */
export function Alert({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="alert"
      className={classes(
        "flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-danger",
        className,
      )}
    >
      <AlertIcon className="mt-px" />
      <div>{children}</div>
    </div>
  );
}

/** Message under one field. Linked with aria-describedby; not announced as an alert twice. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
      <AlertIcon className="mt-0.5 size-4" />
      <span>{children}</span>
    </p>
  );
}

export function Card({
  className,
  fire = false,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { fire?: boolean }) {
  return (
    <div
      className={classes(
        "relative overflow-hidden rounded-2xl border border-subtle bg-surface p-6 shadow-card",
        className,
      )}
      {...props}
    >
      {fire ? <span aria-hidden="true" className="fire-bar absolute inset-x-0 top-0" /> : null}
      {children}
    </div>
  );
}

/** Product mark: the LaunchPad isometric logo plus the product name. */
export function BrandMark({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string | undefined;
}) {
  return (
    <span className={classes("flex items-center gap-3", className)}>
      <img src="/logo-mark.svg" alt="" width={44} height={36} className="h-9 w-auto shrink-0" />
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-tight">LaunchPad</span>
        {subtitle ? <span className="block text-xs text-muted">{subtitle}</span> : null}
      </span>
    </span>
  );
}

type PillTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<PillTone, string> = {
  neutral: "bg-subtle/50 text-primary border-subtle",
  accent: "bg-accent-soft text-accent-strong border-accent/25",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={classes(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={classes(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
