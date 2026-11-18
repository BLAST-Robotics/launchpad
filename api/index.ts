// Self-contained bundle of apps/api, built by `bun run build:api` before deploy. Importing the
// workspace packages directly fails on Vercel (workspace symlinks are not traced into the function).
import { createApp } from "./_bundle/app.js";

/**
 * Vercel catch-all: every /api/* request is the same Elysia app `bun dev` runs.
 *
 * This lives at `api/index.ts` and is reached through the `/api/:path*` rewrite in
 * vercel.json. A file named `api/[...path].ts` produced a route that only matched one
 * segment (`^/api/([^/]+)$`), so nested paths like /api/admin/overview became 404s at the
 * platform level. Vercel preserves the original URL when rewriting into a function, so
 * Elysia still sees `/api/admin/overview`.
 */
const app = createApp();

export default {
  fetch(request: Request): Promise<Response> {
    return app.handle(request);
  },
};
