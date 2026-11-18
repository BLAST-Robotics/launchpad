import { db, schema } from "@launchpad/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { env, isProduction } from "./env";
import { logEvent } from "./observability";

const preferredOrigins = [
  env.BETTER_AUTH_URL,
  // Vite dev server. The browser's Origin is 5173 even though /api is proxied to 3000.
  env.NODE_ENV === "development" ? "http://localhost:5173" : undefined,
].filter((origin): origin is string => Boolean(origin));

/**
 * Better Auth with Google OAuth, external audience, basic scopes only (D-004).
 *
 * The Drizzle adapter resolves models by Better Auth's default table/column names;
 * `packages/db/src/schema/auth.ts` mirrors them exactly. IDs are UUIDs because
 * Postgres generates them and we force the same shape here.
 */
export const auth = betterAuth({
  ...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...new Set(preferredOrigins)],

  database: drizzleAdapter(db, {
    provider: "pg",
    // Better Auth resolves models by singular name (user, session, ...); our exports are plural.
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      scope: ["openid", "email", "profile"],
    },
  },

  // D-021: email + password sign-up with no verification. No email is ever sent.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    autoSignIn: true,
  },

  // Linking is OFF on purpose. A password account is unverified, so letting a Google
  // sign-in with the same email merge into it would let anyone who pre-registered a
  // victim's address take over the victim's later Google account. The user gets an
  // `account_not_linked` error instead, and an admin resolves it (D-021).
  account: {
    accountLinking: {
      enabled: false,
    },
  },

  rateLimit: {
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },

  user: {
    additionalFields: {
      roles: {
        type: "string[]",
        required: false,
        defaultValue: ["pending"],
        input: false,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "active",
        input: false,
      },
      rosterEntryId: {
        type: "string",
        required: false,
        input: false,
      },
      googleSub: {
        type: "string",
        required: false,
        input: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh at most once a day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: isProduction,
      httpOnly: true,
    },
  },

  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          // accountId is the Google `sub`. Cache it on the user so Phase 2 provisioning
          // does not need to read the account table. Failure must not break sign-in.
          if (account.providerId !== "google") return;
          try {
            await db
              .update(schema.users)
              .set({ googleSub: account.accountId })
              .where(eq(schema.users.id, account.userId));
          } catch {
            logEvent("auth.google_sub_cache_failed", { userId: account.userId });
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          try {
            await db
              .update(schema.users)
              .set({ lastLoginAt: new Date() })
              .where(eq(schema.users.id, session.userId));
          } catch {
            logEvent("auth.last_login_update_failed", { userId: session.userId });
          }
        },
      },
    },
  },
});

export type Auth = typeof auth;
