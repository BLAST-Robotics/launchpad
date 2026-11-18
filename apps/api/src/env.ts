import { parseEmailList } from "@launchpad/shared";
import { z } from "zod";

/**
 * Environment is parsed once at module load so a bad deploy fails at boot, not on the
 * first request. Errors name the variable, never print its value.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  BETTER_AUTH_SECRET: z.string().min(32),
  // Optional: preview deployments infer the origin from the request. Production sets it.
  BETTER_AUTH_URL: z.string().url().optional(),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Temporary (D-022): treat everyone on the roster as having signed the waiver, shown as
  // "Signed (assumed for now)". Set to "false" once e-sign is live.
  WAIVERS_ASSUMED_SIGNED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  // KeySign (D-008). Neither is required to boot; each feature reports "not connected".
  KEYSIGN_SIGNING_URL: z.string().url().optional(),
  KEYSIGN_WEBHOOK_SECRET: z.string().min(16).optional(),

  // Google Groups check (read-only). Neither is required to boot; the check reports "not connected".
  GOOGLE_SERVICE_ACCOUNT_JSON: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  GOOGLE_WORKSPACE_ADMIN_EMAIL: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),

  // Comma-separated emails that become admins when they sign in with Google (D-023). Never in
  // source. Password sign-up is blocked for these addresses (no email verification, D-021).
  ADMIN_EMAILS: z
    .string()
    .optional()
    .transform((value) => parseEmailList(value)),

  // Optional. Absent means error reporting is a no-op.
  SENTRY_DSN: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const names = [
    ...new Set(
      parsed.error.issues.map((issue) => issue.path.join(".") || "environment").filter(Boolean),
    ),
  ];
  throw new Error(`Invalid environment. Check: ${names.join(", ")}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
