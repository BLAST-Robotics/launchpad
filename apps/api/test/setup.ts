import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Test preload.
 *
 * `bun test` does not read `.env.local`, so by default every test runs against placeholders
 * and never touches a real database. Tests that need one (they create and delete throwaway
 * rows) are opt-in:
 *
 *   RUN_DB_TESTS=1 bun test
 *
 * which loads `.env.local` first. The project has a single Neon database, so this is the
 * only guard between a test run and live data; CI does not set it.
 */
if (process.env.RUN_DB_TESTS === "1") {
  const file = resolve(import.meta.dir, "../../../.env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match?.[1] || match[1].startsWith("VERCEL_")) continue;
      const value = (match[2] ?? "").replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] ??= value;
    }
  }
}

process.env.NODE_ENV ??= "test";
process.env.KEYSIGN_WEBHOOK_SECRET ??= "test-webhook-secret-test-secret";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/launchpad_test";

// Fake allowlist for tests, always: a real list from .env.local must never reach a test.
process.env.ADMIN_EMAILS = "Fake-Admin@example.test";
